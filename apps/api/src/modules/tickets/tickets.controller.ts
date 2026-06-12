import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('api/v1/tickets')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('me')
  @RequirePermissions(Permission.TICKET_VIEW_OWN)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 3
    return [];
  }
}
