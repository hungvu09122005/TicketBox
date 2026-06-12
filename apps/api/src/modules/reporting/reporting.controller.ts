import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { ReportingService } from './reporting.service';

@ApiTags('reporting')
@ApiBearerAuth()
@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('revenue')
  @RequirePermissions(Permission.REPORT_VIEW)
  getRevenue() { return { message: 'Not implemented — Phase 8' }; }

  @Get('tickets-sold')
  @RequirePermissions(Permission.REPORT_VIEW)
  getTicketsSold() { return { message: 'Not implemented — Phase 8' }; }

  @Get('checkin-rate')
  @RequirePermissions(Permission.REPORT_VIEW)
  getCheckinRate() { return { message: 'Not implemented — Phase 8' }; }
}
