import { Controller, Post, Get, Param, Body, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
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


  @ApiBody({
  schema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        example: 'MoriRan123@gmail.com',
      },
      ticketId: {
        type: 'string',
        example: 'b3f49005-3682-4d25-8f33-99cdef9890bb',
      },
    },
    required: ['email', 'ticketId'],
  },
})



  @Post('test-confirmation')
  @RequirePermissions(Permission.REPORT_VIEW)
  async testConfirmation(
    @Body() body: { email: string; ticketId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.queueTicketConfirmation({
      toEmail: body.email,
      toName: user.email,
      ticketId: body.ticketId,
      userId: user.sub,
      orderId: 'TEST_ORDER',
      concertName: 'TicketBox Test Concert',
      concertDate: new Date(),
      venue: 'TicketBox Test Venue',
      ticketTypeName: 'Test Ticket',
      qrToken: 'TEST_QR_TOKEN',
    });
  }
}
