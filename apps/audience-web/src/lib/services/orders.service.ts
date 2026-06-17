import { apiClient } from '../api-client';
import type { AudienceOrder } from '../types';

export interface CreateOrderPayload {
  concertId: string;
  ticketTypeId: string;
  quantity: number;
}

export const ordersService = {
  createOrder: async (payload: CreateOrderPayload, idempotencyKey: string): Promise<AudienceOrder> => {
    const response = await apiClient.post('/orders', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return response.data.data;
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

