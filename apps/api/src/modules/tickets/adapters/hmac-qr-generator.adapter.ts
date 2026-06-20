import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  QrCodeGeneratorPort,
  QrTokenParams,
  QrTokenPayload,
} from '../../../common/ports/qr-code-generator.port';

/**
 * HmacQrGeneratorAdapter — HMAC-SHA256 signed QR token generator.
 * Blueprint §04-database-design §4: "unique, hard to guess, verifiable. No PII."
 *
 * Token format: base64url(ticketId|concertId|ticketTypeId|timestamp).HMAC
 * Secret: QR_TOKEN_SECRET from config.
 */
@Injectable()
export class HmacQrGeneratorAdapter implements QrCodeGeneratorPort {
  constructor(private readonly configService: ConfigService) {}

  generateToken(params: QrTokenParams): string {
    const secret = this.configService.get<string>('QR_TOKEN_SECRET', 'ticketbox-qr-secret');
    const payload = Buffer.from(JSON.stringify(params)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}.${signature}`;
  }

  verifyToken(token: string): QrTokenPayload | null {
    const secret = this.configService.get<string>('QR_TOKEN_SECRET', 'ticketbox-qr-secret');
    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
      return null;
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (signature !== expectedSignature) {
      return null;
    }

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<QrTokenPayload>;
      if (!decoded.ticketId || !decoded.concertId || !decoded.ticketTypeId) {
        return null;
      }

      return {
        ticketId: decoded.ticketId,
        concertId: decoded.concertId,
        ticketTypeId: decoded.ticketTypeId,
      };
    } catch {
      return null;
    }
  }
}
