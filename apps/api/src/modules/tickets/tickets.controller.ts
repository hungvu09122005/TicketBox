import { Controller, Get, UseGuards, ForbiddenException, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { TicketsService } from './tickets.service';
import { TicketQueryDto } from './dto/ticket-query.dto';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('me')
  @RequirePermissions(Permission.TICKET_VIEW_OWN)
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: TicketQueryDto) {
    return this.ticketsService.findMineWithFilters(user.sub, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.TICKET_VIEW_OWN)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    const ticket = await this.ticketsService.findOne(id);
    if (!isAdmin && ticket.userId !== user.sub) {
      throw new ForbiddenException();
    }
    return ticket;
  }

  @Get()
  @RequirePermissions(Permission.ORDER_READ_ALL) // Organizer/Admin only — Audience must use GET /tickets/me
  async findAll(@Query('concertId') concertId: string) {
    return await this.ticketsService.findByConcert(concertId);
  }

  
}
