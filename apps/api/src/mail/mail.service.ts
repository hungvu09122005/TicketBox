import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

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
  private readonly timeoutMs = Number(process.env.MAIL_TIMEOUT_MS || 10000);

  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    try {
      await Promise.race([
        this.mailerService.sendMail({
          to: params.to,
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
      console.error('MAIL_PROVIDER_RAW_ERROR:', error);

      throw new EmailProviderError(
        `EMAIL_PROVIDER_ERROR: ${error?.message || 'Unknown email provider error'}`,
          error,
      );
    }
   }
}