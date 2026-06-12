import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import { NOTIFICATION_PORT, NotificationPort } from '../../../common/ports/notification.port';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(@Inject(NOTIFICATION_PORT) private readonly notificationPort: NotificationPort) {}

  @Process('notification.ticket_confirmation')
  async handleTicketConfirmation(job: Job): Promise<void> {
    // TODO Phase 4: call notificationPort.sendTicketConfirmation(), update log
    this.logger.log(`[STUB] ticket_confirmation job received`);
  }

  @Process('notification.reminder')
  async handleReminder(job: Job): Promise<void> {
    // TODO Phase 4: call notificationPort.sendConcertReminder(), idempotency check
    this.logger.log(`[STUB] reminder job received`);
  }
}
