import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { CheckinService } from './checkin.service';
import { CheckinDto, RegisterDeviceDto, SyncDatasetQueryDto } from './dto/checkin.dto';

import { RateLimitPolicy } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ApiTags('checkin')
@ApiBearerAuth()
@Controller('checkin')
<<<<<<< HEAD
=======
@UseGuards(JwtAuthGuard, RbacGuard)
>>>>>>> c100341 (feat: complete ticket validation and rbac configuration)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Post('validate')
  @RateLimitPolicy('checkin')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  @UseGuards(JwtAuthGuard, RbacGuard, RateLimitGuard)
  async validateOnline(@Body() dto: CheckinDto, @CurrentUser() user: AuthenticatedUser) {
    return await this.checkinService.validateOnline(dto, user);
  }

  @Post('devices/register')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  @UseGuards(JwtAuthGuard, RbacGuard)
  async registerDevice(@Body() dto: RegisterDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    return await this.checkinService.registerDevice(dto, user.sub);
  }

  @Get('sync/dataset')
  async getSyncDataset(@Query() query: SyncDatasetQueryDto) {
    // Tải dữ liệu vé offline bằng deviceToken được cấp ở bước registerDevice
    return await this.checkinService.getSyncDataset(query);
  }

  @Post('sync')
  @RateLimitPolicy('sync')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  @UseGuards(JwtAuthGuard, RbacGuard, RateLimitGuard)
  async syncOfflineEvents(@Body() logs: CheckinDto[], @CurrentUser() user: AuthenticatedUser) {
    return await this.checkinService.processSyncBatch(logs, user.sub);
  }
}