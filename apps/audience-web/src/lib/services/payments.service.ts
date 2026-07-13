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

  handleVnpayCallback: async (queryString: string): Promise<any> => {
    const response = await apiClient.get(`/payments/callback/vnpay?${queryString}`);
    return response.data;
  },
};

