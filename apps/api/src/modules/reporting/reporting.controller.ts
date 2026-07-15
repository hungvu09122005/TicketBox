import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { ReportingService } from './reporting.service';
import { ReportQueryDto } from './dto/report-query.dto';

import { RateLimitPolicy } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ApiTags('reporting')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RbacGuard, RateLimitGuard)
@RateLimitPolicy('admin')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('revenue')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getRevenue(@Query() query: ReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return await this.reportingService.getRevenueSummary(isAdmin, user.sub, query.concertId, query.startDate, query.endDate);
  }

  @Get('revenue/timeline')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getRevenueTimeline(@Query() query: ReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return await this.reportingService.getRevenueTimeline(isAdmin, user.sub, query.concertId, query.startDate, query.endDate);
  }

  @Get('tickets-sold')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getTicketsSold(@Query() query: ReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return await this.reportingService.getTicketsSold(isAdmin, user.sub, query.concertId, query.startDate, query.endDate);
  }

  @Get('tickets-sold/timeline')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getTicketsSoldTimeline(@Query() query: ReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return await this.reportingService.getTicketsSoldTimeline(isAdmin, user.sub, query.concertId, query.startDate, query.endDate);
  }

  @Get('order-status')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getOrderStatus(@Query() query: ReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return await this.reportingService.getOrderStatusBreakdown(isAdmin, user.sub, query.concertId, query.startDate, query.endDate);
  }

  @Get('checkin-rate')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getCheckinRate(@Query() query: ReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    // Checkin rate only uses concertId filter based on repository implementation
    return await this.reportingService.getCheckinRate(isAdmin, user.sub, query.concertId);
  }

  @Get('checkin-rate/timeline')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getCheckinRateTimeline(@Query() query: ReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return await this.reportingService.getCheckinRateTimeline(isAdmin, user.sub, query.concertId, query.startDate, query.endDate);
  }
}
