import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * ReminderScheduler — hourly cron that finds concerts starting in 22–26h
 * and enqueues reminder jobs. Blueprint §05 §3.2 Main step 5.
 * Idempotent: NotificationsService checks notification_logs before enqueueing.
 */
@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleReminders(): Promise<void> {
    // TODO Phase 4: query concerts in 22-26h window → enqueue reminder per active ticket
    this.logger.log('[STUB] reminder scheduler tick');
  }
}
