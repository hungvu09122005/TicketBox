import { Processor, Process } from '@nestjs/bull'; // Import chuẩn của bản cũ
import { Job } from 'bull'; // Import từ 'bull'
import { Logger, Inject } from '@nestjs/common';
import { NOTIFICATION_PORT, NotificationPort } from '../../../common/ports/notification.port';
import { NotificationsRepository } from '../notifications.repository';
import { NotificationChannel, NotificationType } from '../entities/notification-log.entity';

@Processor('notifications') // Tên queue
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  // Không cần extends WorkerHost nên không cần constructor gọi super()
  constructor(
    @Inject(NOTIFICATION_PORT) 
    private readonly notificationPort: NotificationPort,
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  // Dùng @Process để chỉ định job cụ thể
  @Process('notification.ticket_confirmation')
  async handleTicketConfirmation(job: Job): Promise<void> {
    this.logger.log(`Processing ticket_confirmation job: ${job.id}`);
    try {
      await this.notificationPort.sendTicketConfirmation(job.data as any);
      if (job.data?.logId) {
        await this.notificationsRepository.markSent(String(job.data.logId));
      } else if (job.data?.ticketId) {
        const log = await this.notificationsRepository.findByTicketTypeChannel(
          String(job.data.ticketId),
          NotificationType.TICKET_CONFIRMATION,
          NotificationChannel.EMAIL,
        );
        if (log) {
          await this.notificationsRepository.markSent(log.id);
        }
      }
      this.logger.log(`Ticket confirmation sent for job: ${job.id}`);
    } catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));

  this.logger.error(
    `Failed to process ticket_confirmation. Job: ${job.id}, attempt ${job.attemptsMade}/${job.opts.attempts}`,
    error.stack,
  );

  const maxAttempts = Number(job.opts.attempts ?? 1);
  const isFinalAttempt = job.attemptsMade >= maxAttempts;

  if (isFinalAttempt) {
    if (job.data?.logId) {
      await this.notificationsRepository.markFailed(String(job.data.logId));
    } else if (job.data?.ticketId) {
      const log = await this.notificationsRepository.findByTicketTypeChannel(
        String(job.data.ticketId),
        NotificationType.TICKET_CONFIRMATION,
        NotificationChannel.EMAIL,
      );
      if (log) {
        await this.notificationsRepository.markFailed(log.id);
      }
    }
  }

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
