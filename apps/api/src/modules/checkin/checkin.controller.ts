import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { CheckinService } from './checkin.service';

@ApiTags('checkin')
@ApiBearerAuth()
@Controller('api/v1/checkin')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Post('validate')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  validateOnline(@CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 5: body = { qrToken, deviceId }
    return { message: 'Not implemented — Phase 5' };
  }

  @Get('sync/dataset')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  getSyncDataset(@CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 5: scoped to staff's assigned concert/gate
    return { message: 'Not implemented — Phase 5' };
  }

  @Post('sync')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  syncOfflineEvents(@CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 5: batch of offline events, idempotent
    return { message: 'Not implemented — Phase 5' };
  }
}
