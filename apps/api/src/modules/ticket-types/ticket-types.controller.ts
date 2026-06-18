import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { TicketTypesService } from './ticket-types.service';

@ApiTags('ticket-types')
@ApiBearerAuth()
@Controller('concerts/:concertId/ticket-types')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TicketTypesController {
  constructor(private readonly ticketTypesService: TicketTypesService) {}

  @Get()
  @RequirePermissions(Permission.CONCERT_READ)
  findByConcert(@Param('concertId') concertId: string) {
    // TODO Phase 2
    return [];
  }

  @Get('availability')
  @RequirePermissions(Permission.CONCERT_READ)
  getAvailability(@Param('concertId') concertId: string) {
    // TODO Phase 2 — reads from Redis cache (TTL 5–10s), DB fallback
    return [];
  }
}
