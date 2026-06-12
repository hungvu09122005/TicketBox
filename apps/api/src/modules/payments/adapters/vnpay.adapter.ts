import { Injectable } from '@nestjs/common';
import {
  PaymentPort,
  CreatePaymentParams,
  PaymentCallbackResult,
} from '../../../common/ports/payment.port';

/**
 * VnpayAdapter — concrete implementation of PaymentPort for VNPAY sandbox.
 * Blueprint §05 §3.1, No-Mock Policy: calls real VNPAY sandbox, signed requests only.
 *
 * NEVER return a hard-coded success. All results come from the real VNPAY sandbox.
 * Credentials read from config (VNPAY_TMN_CODE, VNPAY_HASH_SECRET).
 *
 * Circuit breaker is applied in PaymentsService (Opossum), not here.
 */
@Injectable()
export class VnpayAdapter implements PaymentPort {
  async createPaymentUrl(params: CreatePaymentParams): Promise<string> {
    // TODO Phase 3: build VNPAY signed URL using VNPAY SDK / manual HMAC-SHA512
    throw new Error('VnpayAdapter.createPaymentUrl not implemented — Phase 3');
  }

  async verifyCallback(rawQuery: Record<string, string>): Promise<PaymentCallbackResult | null> {
    // TODO Phase 3: verify VNPAY vnp_SecureHash using HMAC-SHA512; return null if invalid
    throw new Error('VnpayAdapter.verifyCallback not implemented — Phase 3');
  }
}
