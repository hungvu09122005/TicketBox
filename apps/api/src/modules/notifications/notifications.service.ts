import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationsRepository } from './notifications.repository';

/**
 * NotificationsService — exported surface consumed by PaymentsModule and CsvImportModule.
 * Enqueuing is idempotent: checks notification_logs UNIQUE constraint before enqueueing.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repo: NotificationsRepository,
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {}
  // TODO Phase 4: enqueueTicketConfirmation, enqueueReminder, enqueueVipWelcome, enqueueConcertUpdate
}
