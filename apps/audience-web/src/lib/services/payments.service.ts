import { apiClient } from '../api-client';
import type { PaymentInitiationResult } from '../types';

export const paymentsService = {
  initiatePayment: async (orderId: string, idempotencyKey: string): Promise<PaymentInitiationResult> => {
    const response = await apiClient.post(`/payments/${orderId}/initiate`, undefined, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return response.data.data ?? response.data;
  },
};
