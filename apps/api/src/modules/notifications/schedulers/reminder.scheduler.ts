import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications.service';
import { InjectDataSource } from '@nestjs/typeorm';

/**
 * ReminderScheduler â€” hourly cron that finds concerts starting in 22â€“26h
 * and enqueues reminder jobs. Blueprint Â§05 Â§3.2 Main step 5.
 * Idempotent: NotificationsService checks notification_logs before enqueueing.
 */

interface ReminderTicketRow {
  ticket_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  concert_name: string;
  concert_date: Date;
  venue: string | null;
  ticket_type_name: string;
}

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleReminders(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 22 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const rows = await this.dataSource.query<ReminderTicketRow[]>(
      `
        SELECT
          t.id AS ticket_id,
          t.user_id AS user_id,
          u.email AS user_email,
          u.name AS user_name,
          c.name AS concert_name,
          c.starts_at AS concert_date,
          c.venue AS venue,
          tt.name AS ticket_type_name
        FROM tickets t
        INNER JOIN orders o ON o.id::text = t.order_id::text
        INNER JOIN concerts c ON c.id::text = t.concert_id::text
        INNER JOIN users u ON u.id::text = t.user_id::text
        INNER JOIN ticket_types tt ON tt.id::text = t.ticket_type_id::text
        WHERE t.status = $1
          AND o.status = $2
          AND c.status = $3
          AND c.starts_at >= $4
          AND c.starts_at < $5
          AND u.is_active = true
      `,
      ['ACTIVE', 'PAID', 'PUBLISHED', windowStart, windowEnd],
    );

    let queued = 0;
    let skipped = 0;

    for (const row of rows) {
      const result = await this.notificationsService.queueConcertReminder({
        toEmail: row.user_email,
        toName: row.user_name,
        ticketId: row.ticket_id,
        userId: row.user_id,
        concertName: row.concert_name,
        concertDate: row.concert_date,
        venue: row.venue ?? 'TBA',
        ticketTypeName: row.ticket_type_name,
      });

      if (result.skipped) {
        skipped += 1;
      } else {
        queued += 1;
      }
    }

    this.logger.log(
      `24h reminder scheduler finished. candidates=${rows.length}, queued=${queued}, skipped=${skipped}`,
    );
  }
}
