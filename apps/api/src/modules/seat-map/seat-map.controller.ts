import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { SeatMapService } from './seat-map.service';

@ApiTags('seat-map')
@ApiBearerAuth()
@Controller('concerts/:concertId/seat-map')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SeatMapController {
  constructor(private readonly seatMapService: SeatMapService) {}

  @Get()
  @RequirePermissions(Permission.CONCERT_READ)
  getZones(@Param('concertId') concertId: string) {
    // TODO Phase 2 — returns zone list with presigned SVG URL
    return [];
  }
}
