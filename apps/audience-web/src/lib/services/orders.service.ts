import { apiClient } from '../api-client';
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
    return response.data.data ?? response.data;
  },

  getQueueStatus: async (concertId: string): Promise<{ status: 'ACTIVE' | 'QUEUED'; position?: number }> => {
    const response = await apiClient.get('/orders/queue/status', {
      params: {
        concertId,
      },
    });
    return response.data.data ?? response.data;
  },

  getMyOrders: async (): Promise<AudienceOrder[]> => {
    const response = await apiClient.get('/orders/me');
    return response.data.data;
  },

  getOrderById: async (orderId: string): Promise<AudienceOrder> => {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data.data;
  },
};
