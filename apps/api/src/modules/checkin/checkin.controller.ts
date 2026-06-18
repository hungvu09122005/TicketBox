import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { CheckinService } from './checkin.service';
import { CheckinDto } from './dto/checkin.dto';

@ApiTags('checkin')
@ApiBearerAuth()
@Controller('checkin')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Post('validate')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  async validateOnline(@Body() dto: CheckinDto, @CurrentUser() user: AuthenticatedUser) {
    // Gọi Service online (đã có transaction logic)
    return await this.checkinService.validateOnline(dto, user);
  }

  @Get('sync/dataset')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  async getSyncDataset(@CurrentUser() user: AuthenticatedUser) {
    // Lấy dữ liệu vé hợp lệ để máy offline tải về
    return await this.checkinService.getSyncDataset();
  }

  @Post('sync')
  @RequirePermissions(Permission.TICKET_VALIDATE)
  async syncOfflineEvents(@Body() logs: CheckinDto[], @CurrentUser() user: AuthenticatedUser) {
    // Xử lý batch dữ liệu từ offline mode
    return await this.checkinService.processSyncBatch(logs);
  }
}