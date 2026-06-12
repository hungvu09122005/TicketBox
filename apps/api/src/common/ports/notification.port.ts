/**
 * NotificationPort — dependency inversion interface for email / push notification providers.
 * Blueprint §01-system-design §7.2, ADR-13
 *
 * Concrete adapters:
 *   - SendgridNotificationAdapter (apps/api/src/modules/notifications/adapters/sendgrid.adapter.ts)
 *
 * Future adapters: ZaloOA, SMS, App Push — all implement this interface without changing
 * domain/application code.
 *
 * RULE: NotificationWorker and NotificationService depend ONLY on this interface.
 */
export interface NotificationPort {
  /**
   * Send a transactional email with e-ticket attachment.
   */
  sendTicketConfirmation(params: TicketConfirmationParams): Promise<void>;

  /**
   * Send a concert reminder email (24h before event).
   */
  sendConcertReminder(params: ConcertReminderParams): Promise<void>;

  /**
   * Send a general notification email (e.g. concert update, cancellation).
   */
  sendGeneralNotification(params: GeneralNotificationParams): Promise<void>;
}

export interface TicketConfirmationParams {
  toEmail: string;
  toName: string;
  concertName: string;
  concertDate: Date;
  venue: string;
  ticketTypeName: string;
  qrToken: string;   // Used to render QR on client; never embed sensitive data
  orderId: string;
}

export interface ConcertReminderParams {
  toEmail: string;
  toName: string;
  concertName: string;
  concertDate: Date;
  venue: string;
  ticketTypeName: string;
}

export interface GeneralNotificationParams {
  toEmail: string;
  toName: string;
  subject: string;
  bodyHtml: string;
}

/** DI injection token */
export const NOTIFICATION_PORT = 'NOTIFICATION_PORT';
