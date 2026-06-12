import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { ConcertsService } from './concerts.service';

@ApiTags('concerts')
@ApiBearerAuth()
@Controller('api/v1/concerts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Get()
  @RequirePermissions(Permission.CONCERT_READ)
  findAll() {
    return this.concertsService.findPublished();
  }

  @Get(':id')
  @RequirePermissions(Permission.CONCERT_READ)
  findOne(@Param('id') id: string) {
    return this.concertsService.findById(id);
  }

  @Post()
  @RequirePermissions(Permission.CONCERT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    // TODO Phase 2: implement CreateConcertDto + ConcertsService.createConcert()
    return { message: 'Not implemented — Phase 2' };
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    // TODO Phase 2: ownership check + updateConcert
    return { message: 'Not implemented — Phase 2' };
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 2: cancelConcert with ownership check
    return { message: 'Not implemented — Phase 2' };
  }
}
