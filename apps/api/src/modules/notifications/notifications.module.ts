import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationProcessor } from './processors/notification.processor';
import { ReminderScheduler } from './schedulers/reminder.scheduler';
import { SendgridAdapter } from './adapters/sendgrid.adapter';
import { NOTIFICATION_PORT } from '../../common/ports/notification.port';
import { MailModule } from '../../mail/mail.module';


/**
 * NotificationsModule — email delivery + 24h reminder scheduler.
 *
 * Dependency rules:
 *   - Standalone module (no domain module dependencies).
 *   - NotificationPort fulfilled by SendgridAdapter (real SendGrid sandbox).
 *   - NotificationsService exported for PaymentsModule + CsvImportModule.
 *   - ReminderScheduler: bullMQ repeatable job, runs hourly, idempotent.
 *   - UNIQUE(ticketId, type, channel) in DB prevents duplicate delivery.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationLog]),
    BullModule.registerQueue({ name: 'notifications' }),
    ScheduleModule.forRoot(),
    MailModule,
  ],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationProcessor,
    ReminderScheduler,
    { provide: NOTIFICATION_PORT, useClass: SendgridAdapter },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
