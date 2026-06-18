import { Processor, Process } from '@nestjs/bull'; // Import chuẩn của bản cũ
import { Job } from 'bull'; // Import từ 'bull'
import { Logger, Inject } from '@nestjs/common';
import { NOTIFICATION_PORT, NotificationPort } from '../../../common/ports/notification.port';

@Processor('notifications') // Tên queue
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  // Không cần extends WorkerHost nên không cần constructor gọi super()
  constructor(
    @Inject(NOTIFICATION_PORT) 
    private readonly notificationPort: NotificationPort
  ) {}

  // Dùng @Process để chỉ định job cụ thể
  @Process('notification.ticket_confirmation')
  async handleTicketConfirmation(job: Job): Promise<void> {
    this.logger.log(`Processing ticket_confirmation job: ${job.id}`);
    try {
      await this.notificationPort.sendTicketConfirmation(job.data as any);
      this.logger.log(`Ticket confirmation sent for job: ${job.id}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Failed to process ticket_confirmation. Job: ${job.id}`, error.stack);
      throw error; 
    }
  }

  @Process('notification.reminder')
  async handleReminder(job: Job): Promise<void> {
    this.logger.log(`Processing reminder job: ${job.id}`);
    try {
      await this.notificationPort.sendConcertReminder(job.data as any);
      this.logger.log(`Reminder sent for job: ${job.id}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Failed to process reminder. Job: ${job.id}`, error.stack);
      throw error;
    }
  }
}