/**
 * QrCodeGeneratorPort — dependency inversion interface for QR token generation.
 * Blueprint §04-database-design §4 (UNIQUE constraint on tickets.qr_token)
 *
 * Concrete adapters:
 *   - HmacQrGeneratorAdapter (apps/api/src/modules/tickets/adapters/hmac-qr-generator.adapter.ts)
 *
 * RULE: QR tokens must be unique, hard to guess, and verifiable.
 * Must NOT expose sensitive personal data in the payload.
 */
export interface QrCodeGeneratorPort {
  /**
   * Generate a signed, opaque QR token for a ticket.
   * The token embeds ticketId + concertId + a HMAC signature.
   *
   * @returns Compact token string safe to embed in a QR code.
   */
  generateToken(params: QrTokenParams): string;

  /**
   * Verify a QR token and extract its payload.
   * @returns Parsed payload if valid; null if signature fails or token is malformed.
   */
  verifyToken(token: string): QrTokenPayload | null;
}

export interface QrTokenParams {
  ticketId: string;
  concertId: string;
  ticketTypeId: string;
}

export interface QrTokenPayload {
  ticketId: string;
  concertId: string;
  ticketTypeId: string;
}

/** DI injection token */
export const QR_CODE_GENERATOR_PORT = 'QR_CODE_GENERATOR_PORT';
