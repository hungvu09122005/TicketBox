import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        transport: {
            host: config.get('MAIL_HOST') || '',
            port: parseInt(config.get('MAIL_PORT') || '587', 10),
            auth: {
                user: config.get('MAIL_USER') || '',
                pass: config.get('MAIL_PASS') || '',
            },
        },
        
        defaults: {
          from: `"TicketBox" <${config.get('MAIL_FROM')}>`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}