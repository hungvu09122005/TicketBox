/**
 * PaymentPort — dependency inversion interface for payment gateway integrations.
 * Blueprint §01-system-design §7.2, ADR-06
 *
 * Concrete adapters:
 *   - VnpayPaymentAdapter  (apps/api/src/modules/payments/adapters/vnpay.adapter.ts)
 *   - MomoPaymentAdapter   (future)
 *
 * RULE: Domain/Application services MUST depend on this interface, never on SDK types.
 */
export interface PaymentPort {
  /**
   * Create a payment request and return the redirect URL for the user.
   * Called AFTER the order is committed to PostgreSQL.
   */
  createPaymentUrl(params: CreatePaymentParams): Promise<string>;

  /**
   * Verify and parse an incoming IPN / return callback from the gateway.
   * Must validate signature, amount, and order reference.
   * Returns null if signature is invalid.
   */
  verifyCallback(rawQuery: Record<string, string>): Promise<PaymentCallbackResult | null>;
}

export interface CreatePaymentParams {
  orderId: string;
  amount: number;          // VND, integer
  orderDescription: string;
  ipAddress: string;
  idempotencyKey: string;
}

export interface PaymentCallbackResult {
  orderId: string;
  providerTransactionId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  rawData: Record<string, string>;
}

/** DI injection token */
export const PAYMENT_PORT = 'PAYMENT_PORT';
