import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import { NOTIFICATION_PORT, NotificationPort } from '../../../common/ports/notification.port';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Inject(NOTIFICATION_PORT) 
    private readonly notificationPort: NotificationPort
  ) {}

  @Process('notification.ticket_confirmation')
  async handleTicketConfirmation(job: Job): Promise<void> {
    this.logger.log(`Processing ticket_confirmation job: ${job.id}`);
    
    try {
      // Truyền dữ liệu vào port, ép kiểu 'any' để bỏ qua lỗi TS khi chưa có interface cụ thể
      await this.notificationPort.sendTicketConfirmation(job.data as any);
      
      this.logger.log(`Ticket confirmation sent for job: ${job.id}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Failed to process ticket_confirmation. Job: ${job.id}`, error.stack);
      
      // Ném lỗi để BullMQ biết job thất bại và thực hiện retry
      throw error; 
    }
  }

  @Process('notification.reminder')
  async handleReminder(job: Job): Promise<void> {
    this.logger.log(`Processing reminder job: ${job.id}`);

    try {
      // Gọi qua port sau khi đã check logic (cần thực hiện kiểm tra lũy đẳng ở Service)
      await this.notificationPort.sendConcertReminder(job.data as any);
      
      this.logger.log(`Reminder sent for job: ${job.id}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Failed to process reminder. Job: ${job.id}`, error.stack);
      
      throw error;
    }
  }
}