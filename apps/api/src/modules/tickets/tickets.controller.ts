import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { TicketsService } from './tickets.service';
import { Query } from '@nestjs/common';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('me')
  @RequirePermissions(Permission.TICKET_VIEW_OWN)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 3
    return [];
  }

  @Get()
  @RequirePermissions(Permission.TICKET_VIEW_OWN) // Hoặc quyền quản trị tùy theo dự án
  async findAll(@Query('concertId') concertId: string) {
    // Gọi service để lấy vé theo concertId
    return await this.ticketsService.findByConcert(concertId);
  }

  
}
