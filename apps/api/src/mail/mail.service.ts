import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendTestEmail(to: string) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Test Email từ TicketBox',
        text: 'Chào Phúc, hệ thống gửi mail đã hoạt động thành công!',
      });
      console.log('Email đã gửi tới:', to);
    } catch (error) {
      console.error('Lỗi gửi email:', error);
    }
  }
}