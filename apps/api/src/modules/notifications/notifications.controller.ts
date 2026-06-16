import { Controller, Post, Body } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Controller('notifications')
export class NotificationsController {
  constructor(
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  @Post('test-confirmation')
  async testConfirmation(@Body() body: { email: string; ticketId: string }) {
    // Đẩy job vào hàng đợi
    await this.notificationQueue.add('notification.ticket_confirmation', {
      email: body.email,
      ticketId: body.ticketId,
    });
    return { message: 'Job ticket_confirmation đã được đẩy vào queue!' };
  }
}