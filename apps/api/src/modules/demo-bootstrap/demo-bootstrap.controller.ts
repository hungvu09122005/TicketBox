import { Controller, Post, Get, Param, Body, UseGuards, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { DemoBootstrapService } from './demo-bootstrap.service';
import * as crypto from 'crypto';

@ApiTags('demo-bootstrap')
@ApiBearerAuth()
@Controller('admin/demo/bootstrap')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DemoBootstrapController {
  constructor(private readonly service: DemoBootstrapService) {}

  @Post()
  @RequirePermissions(Permission.RBAC_MANAGE)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Bootstrap the system with demo seed data' })
  async bootstrap(@Body() body: any) {
    const jobId = crypto.randomUUID();
    
    // Default config values
    const options = {
      scenario: body.scenario || 'default',
      createUsers: body.createUsers !== false,
      createAdmin: body.createAdmin !== false,
      createOrganizer: body.createOrganizer !== false,
      createStaff: body.createStaff !== false,
      createAudience: body.createAudience !== false,
      createArtist: body.createArtist !== false,
      createConcert: body.createConcert !== false,
      createTicketTypes: body.createTicketTypes !== false,
      createSeatMap: body.createSeatMap !== false,
      createCsvDemoJob: body.createCsvDemoJob !== false,
      createAiBioDemoJob: body.createAiBioDemoJob !== false,
    };

    await this.service.startBootstrap(jobId, options);

    return {
      jobId,
      status: 'PENDING',
      message: 'Demo bootstrap started',
    };
  }

  @Get(':jobId')
  @RequirePermissions(Permission.RBAC_MANAGE)
  @ApiOperation({ summary: 'Retrieve progress of a demo bootstrap job' })
  async getStatus(@Param('jobId') jobId: string) {
    const status = await this.service.getStatus(jobId);
    if (!status) {
      throw new NotFoundException(`Bootstrap job ${jobId} not found`);
    }
    return status;
  }
}
