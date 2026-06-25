import { Injectable } from '@nestjs/common';
import { MailService } from '../../../mail/mail.service';
import {
  ConcertReminderParams,
  GeneralNotificationParams,
  NotificationPort,
  TicketConfirmationParams,
} from '../../../common/ports/notification.port';

@Injectable()
export class SendgridAdapter implements NotificationPort {
  constructor(private readonly mailService: MailService) {}

  async sendTicketConfirmation(params: TicketConfirmationParams): Promise<void> {
    const concertDate = new Date(params.concertDate).toLocaleString('vi-VN');

    const html = `
      <h2>TicketBox - Xác nhận vé</h2>
      <p>Xin chào <b>${params.toName}</b>,</p>
      <p>Đơn hàng <b>${params.orderId}</b> đã được xác nhận.</p>

      <h3>Thông tin vé</h3>
      <ul>
        <li><b>Sự kiện:</b> ${params.concertName}</li>
        <li><b>Thời gian:</b> ${concertDate}</li>
        <li><b>Địa điểm:</b> ${params.venue}</li>
        <li><b>Loại vé:</b> ${params.ticketTypeName}</li>
      </ul>

      <h3>E-ticket / QR token</h3>
      <p>Xuất trình mã này tại cổng check-in:</p>
      <pre style="white-space: pre-wrap; word-break: break-all;">${params.qrToken}</pre>
    `;

    const text = `
TicketBox - Xác nhận vé

Xin chào ${params.toName},
Đơn hàng ${params.orderId} đã được xác nhận.

Sự kiện: ${params.concertName}
Thời gian: ${concertDate}
Địa điểm: ${params.venue}
Loại vé: ${params.ticketTypeName}

QR token:
${params.qrToken}
`;

    await this.mailService.sendEmail({
      to: params.toEmail,
      subject: `[TicketBox] E-ticket - ${params.concertName}`,
      html,
      text,
    });
  }

  async sendConcertReminder(params: ConcertReminderParams): Promise<void> {
    const concertDate = new Date(params.concertDate).toLocaleString('vi-VN');

    const html = `
      <h2>TicketBox - Nhắc lịch concert</h2>
      <p>Xin chào <b>${params.toName}</b>,</p>
      <p>Sự kiện <b>${params.concertName}</b> sắp diễn ra.</p>

      <ul>
        <li><b>Thời gian:</b> ${concertDate}</li>
        <li><b>Địa điểm:</b> ${params.venue}</li>
        <li><b>Loại vé:</b> ${params.ticketTypeName}</li>
      </ul>

      <p>Vui lòng chuẩn bị QR/e-ticket trước khi đến cổng check-in.</p>
    `;

    const text = `
TicketBox - Nhắc lịch concert

Xin chào ${params.toName},
Sự kiện ${params.concertName} sắp diễn ra.

Thời gian: ${concertDate}
Địa điểm: ${params.venue}
Loại vé: ${params.ticketTypeName}

Vui lòng chuẩn bị QR/e-ticket trước khi đến cổng check-in.
`;

    await this.mailService.sendEmail({
      to: params.toEmail,
      subject: `[TicketBox] Reminder - ${params.concertName}`,
      html,
      text,
    });
  }

  async sendGeneralNotification(params: GeneralNotificationParams): Promise<void> {
    await this.mailService.sendEmail({
      to: params.toEmail,
      subject: params.subject,
      html: params.bodyHtml,
      text: params.bodyHtml.replace(/<[^>]*>/g, ''),
    });
  }
}