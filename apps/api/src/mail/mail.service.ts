import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export class EmailProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly timeoutMs = Number(process.env.MAIL_TIMEOUT_MS || 10000);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    const host =
      this.configService.get<string>('MAIL_HOST') ||
      this.configService.get<string>('SMTP_HOST') ||
      'smtp.gmail.com';

    const port = Number(
      this.configService.get<string>('MAIL_PORT') ||
        this.configService.get<string>('SMTP_PORT') ||
        587,
    );

    const user =
      this.configService.get<string>('EMAIL_USER') ||
      this.configService.get<string>('MAIL_USER') ||
      '';

    const pass =
      this.configService.get<string>('EMAIL_PASS') ||
      this.configService.get<string>('MAIL_PASS') ||
      '';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth:
        user && pass
          ? {
              user,
              pass,
            }
          : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const fromEmail =
      this.configService.get<string>('EMAIL_USER') ||
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('EMAIL_FROM') ||
      'noreply@ticketbox.example.com';
    const fromName =
      this.configService.get<string>('SENDGRID_FROM_NAME') ||
      this.configService.get<string>('MAIL_FROM_NAME') ||
      'TicketBox';

    try {
      await Promise.race([
        this.transporter.sendMail({
          to: params.to,
          from: `${fromName} <${fromEmail}>`,
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Email provider timeout after ${this.timeoutMs}ms`)),
            this.timeoutMs,
          ),
        ),
      ]);
    } catch (error: any) {
      this.logger.error({
        msg: 'SMTP_SEND_FAILED',
        error: error?.message ?? String(error),
        to: params.to,
        subject: params.subject,
      });

      throw new EmailProviderError(
        `EMAIL_PROVIDER_ERROR: ${error?.message || 'Unknown email provider error'}`,
        error,
      );
    }
  }
}
