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
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const ticketUrl = `${frontendUrl}/tickets/${params.ticketId}`;
const qrUrl = `${frontendUrl}/tickets/${params.ticketId}/qr`;

    const html = `
      <h2>TicketBox - XÃ¡c nháº­n vÃ©</h2>
      <p>Xin chÃ o <b>${params.toName}</b>,</p>
      <p>ÄÆ¡n hÃ ng <b>${params.orderId}</b> Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n.</p>

      <h3>ThÃ´ng tin vÃ©</h3>
      <ul>
        <li><b>Sá»± kiá»‡n:</b> ${params.concertName}</li>
        <li><b>Thá»i gian:</b> ${concertDate}</li>
        <li><b>Äá»‹a Ä‘iá»ƒm:</b> ${params.venue}</li>
        <li><b>Loáº¡i vÃ©:</b> ${params.ticketTypeName}</li>
      </ul>

      <h3>E-ticket / QR token</h3>
      <p>Xuáº¥t trÃ¬nh mÃ£ nÃ y táº¡i cá»•ng check-in:</p>
      <pre style="white-space: pre-wrap; word-break: break-all;">${params.qrToken}</pre>
    `;

    const text = `
TicketBox - XÃ¡c nháº­n vÃ©

Xin chÃ o ${params.toName},
ÄÆ¡n hÃ ng ${params.orderId} Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n.

Sá»± kiá»‡n: ${params.concertName}
Thá»i gian: ${concertDate}
Äá»‹a Ä‘iá»ƒm: ${params.venue}
Loáº¡i vÃ©: ${params.ticketTypeName}

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
    const concertDate = new Date(params.concertDate).toLocaleString('vi-VN', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
  });


    const html = `
      <h2>TicketBox - Nháº¯c lá»‹ch concert</h2>
      <p>Xin chÃ o <b>${params.toName}</b>,</p>
      <p>Sá»± kiá»‡n <b>${params.concertName}</b> sáº¯p diá»…n ra trong khoáº£ng 24 giá» tá»›i .</p>

      <h3>ThÃ´ng tin sá»± kiá»‡n</h3>
      <ul>
        <li><b>Thá»i gian:</b> ${concertDate}</li>
        <li><b>Äá»‹a Ä‘iá»ƒm:</b> ${params.venue}</li>
        <li><b>Loáº¡i vÃ©:</b> ${params.ticketTypeName}</li>
      </ul>

      <p>Vui lÃ²ng chuáº©n bá»‹ QR/e-ticket trÆ°á»›c khi Ä‘áº¿n cá»•ng check-in.</p>
    `;

    const text = `
    TicketBox - Nháº¯c lá»‹ch concert

    Xin chÃ o ${params.toName},
    Sá»± kiá»‡n ${params.concertName} sáº¯p diá»…n ra trong 24 giá» tá»›i.

    Thá»i gian: ${concertDate}
    Äá»‹a Ä‘iá»ƒm: ${params.venue}
    Loáº¡i vÃ©: ${params.ticketTypeName}

    Vui lÃ²ng chuáº©n bá»‹ QR/e-ticket trÆ°á»›c khi Ä‘áº¿n cá»•ng check-in.
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
