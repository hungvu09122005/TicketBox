import { Injectable } from '@nestjs/common';
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
  generateToken(params: QrTokenParams): string {
    // TODO Phase 3: build + HMAC-sign compact token
    throw new Error('HmacQrGeneratorAdapter.generateToken not implemented — Phase 3');
  }

  verifyToken(token: string): QrTokenPayload | null {
    // TODO Phase 3: split token, verify HMAC, return payload or null
    throw new Error('HmacQrGeneratorAdapter.verifyToken not implemented — Phase 3');
  }
}
