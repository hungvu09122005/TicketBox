import { apiClient } from '../api-client';
import { unwrapApiData, unwrapApiList } from '../api-response';
import type { AudienceOrder, QueuedCheckoutResponse } from '../types';

export interface CreateOrderPayload {
  concertId: string;
  ticketTypeId: string;
  quantity: number;
  queueToken?: string;
}

export const ordersService = {
  createOrder: async (
    payload: CreateOrderPayload,
    idempotencyKey: string,
  ): Promise<AudienceOrder | QueuedCheckoutResponse> => {
    const response = await apiClient.post('/orders', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return unwrapApiData<AudienceOrder | QueuedCheckoutResponse>(response.data);
  },

  getQueueStatus: async (concertId: string): Promise<{ status: 'ACTIVE' | 'QUEUED'; position?: number }> => {
    const response = await apiClient.get('/orders/queue/status', {
      params: {
        concertId,
      },
    });
    return unwrapApiData<{ status: 'ACTIVE' | 'QUEUED'; position?: number }>(response.data);
  },

  getMyOrders: async (): Promise<AudienceOrder[]> => {
    const response = await apiClient.get('/orders/me');
    return unwrapApiList<AudienceOrder>(response.data);
  },

  getOrderById: async (orderId: string): Promise<AudienceOrder> => {
    const response = await apiClient.get(`/orders/${orderId}`);
    return unwrapApiData<AudienceOrder>(response.data);
  },
};
