import { Injectable } from '@nestjs/common';
import { NOTIFICATION_PORT, NotificationPort } from '../../../common/ports/notification.port';

/** SendgridAdapter — real SendGrid API. Blueprint No-Mock Policy. */
@Injectable()
export class SendgridAdapter implements NotificationPort {
  async sendTicketConfirmation(params: Parameters<NotificationPort['sendTicketConfirmation']>[0]) {
    throw new Error('SendgridAdapter not implemented — Phase 4');
  }
  async sendConcertReminder(params: Parameters<NotificationPort['sendConcertReminder']>[0]) {
    throw new Error('SendgridAdapter not implemented — Phase 4');
  }
  async sendGeneralNotification(params: Parameters<NotificationPort['sendGeneralNotification']>[0]) {
    throw new Error('SendgridAdapter not implemented — Phase 4');
  }
}
