import { Controller, Post, Get, Param, Body, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RbacGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('jobs')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getJobs(@Query('status') status: string) {
    return this.notificationsService.getJobs(status);
  }

  @Get('failed')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getFailedJobs() {
    return this.notificationsService.getJobs('FAILED');
  }

  @Get('jobs/:id')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getJob(@Param('id') id: string) {
    const job = await this.notificationsService.getJob(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }

  @Post('jobs/:id/retry')
  @RequirePermissions(Permission.RBAC_MANAGE) // Only someone with manage access should retry jobs
  async retryJob(@Param('id') id: string) {
    return this.notificationsService.retryJob(id);
  }

  @Post('test-confirmation')
  @RequirePermissions(Permission.REPORT_VIEW)
  async testConfirmation(
    @Body() body: { email: string; ticketId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.queueTicketConfirmation({
      email: body.email,
      ticketId: body.ticketId,
      userId: user.sub,
    });
  }
}
