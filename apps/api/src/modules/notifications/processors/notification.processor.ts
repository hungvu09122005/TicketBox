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
        `Failed to process ticket_confirmation. Job: ${job.id}, attempt ${job.attemptsMade + 1}/${job.opts.attempts}`,
        error.stack,
      );
      await this.handleJobError(job, error, NotificationType.TICKET_CONFIRMATION);
      throw error;
    }
  }

  @Process('notification.concert_reminder')
async handleConcertReminder(job: Job): Promise<void> {
  this.logger.log(`Processing concert_reminder job: ${job.id}`);

  try {
    await this.notificationPort.sendConcertReminder(job.data as any);

    if (job.data?.logId) {
      await this.notificationsRepository.markSent(String(job.data.logId));
    } else if (job.data?.ticketId) {
      const log = await this.notificationsRepository.findByTicketTypeChannel(
        String(job.data.ticketId),
        NotificationType.REMINDER_24H,
        NotificationChannel.EMAIL,
      );

      if (log) {
        await this.notificationsRepository.markSent(log.id);
      }
    }

    this.logger.log(`Concert reminder sent for job: ${job.id}`);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    this.logger.error(
      `Failed to process concert_reminder. Job: ${job.id}, attempt ${job.attemptsMade + 1}/${job.opts.attempts}`,
      error.stack,
    );

    await this.handleJobError(job, error, NotificationType.REMINDER_24H);
    throw error;
  }
}

  @Process('notification.vip_welcome')
  async handleVipWelcome(job: Job): Promise<void> {
    this.logger.log(`Processing vip_welcome job: ${job.id}`);
    try {
      const { toEmail, toName, ticketId, concertName, logId } = job.data;
      
      const subject = `[TicketBox] VIP Welcome - ${concertName}`;
      const bodyHtml = `
        <h2>TicketBox - Chào mừng khách mời VIP</h2>
        <p>Xin chào quý khách <b>${toName}</b>,</p>
        <p>Chúc mừng quý khách đã nhận được vé VIP tham dự sự kiện <b>${concertName}</b>.</p>
        <p>Vui lòng đăng nhập hoặc tải ứng dụng TicketBox bằng email này để xuất trình vé check-in tại sự kiện.</p>
        <p>Mã vé của quý khách là: <b>${ticketId}</b></p>
      `;

      await this.notificationPort.sendGeneralNotification({
        toEmail,
        toName,
        subject,
        bodyHtml,
      });

      if (logId) {
        await this.notificationsRepository.markSent(String(logId));
      } else if (ticketId) {
        const log = await this.notificationsRepository.findByTicketTypeChannel(
          String(ticketId),
          NotificationType.VIP_WELCOME,
          NotificationChannel.EMAIL,
        );
        if (log) {
          await this.notificationsRepository.markSent(log.id);
        }
      }
      this.logger.log(`VIP welcome notification sent for job: ${job.id}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Failed to process vip_welcome. Job: ${job.id}, attempt ${job.attemptsMade + 1}/${job.opts.attempts}`,
        error.stack,
      );
      await this.handleJobError(job, error, NotificationType.VIP_WELCOME);
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

  private async handleJobError(job: Job, error: Error, type: NotificationType) {
    const maxAttempts = Number(job.opts.attempts ?? 1);
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
    
    // Resolve the logId
    let logId = job.data?.logId;
    if (!logId && job.data?.ticketId) {
      const log = await this.notificationsRepository.findByTicketTypeChannel(
        String(job.data.ticketId),
        type,
        NotificationChannel.EMAIL,
      );
      if (log) {
        logId = log.id;
      }
    }

    if (logId) {
      if (isFinalAttempt) {
        await this.notificationsRepository.markFailed(String(logId), error.message);
      } else {
        await this.notificationsRepository.updateFailureReason(
          String(logId),
          `Attempt ${job.attemptsMade + 1} failed: ${error.message}`,
        );
      }
    }
  }
}
