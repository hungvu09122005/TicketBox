import { getStoredAccessToken } from '../auth-session';
import { apiClient } from '../api-client';
import {
  CreateOrderPayload,
  PaymentInitiationResult,
  OrderSummary,
  PublicArtistDetail,
  PublicConcert,
  PublicTicketType,
  SeatMapResponse,
  TicketSummary,
} from '../types';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const concertService = {
  getPublishedConcerts: async (): Promise<PublicConcert[]> => {
    const response = await apiClient.get('/concerts');
    return response.data.data;
  },

  getConcert: async (id: string): Promise<PublicConcert> => {
    const response = await apiClient.get(`/concerts/${id}`);
    return response.data.data;
  },

  getArtist: async (artistId: string): Promise<PublicArtistDetail> => {
    const accessToken = getStoredAccessToken();
    const response = await fetch(`${baseURL}/artists/${artistId}`, {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load artist detail: ${response.status}`);
    }

    const payload = (await response.json()) as { data: PublicArtistDetail };
    return {
      ...payload.data,
      description: payload.data.description ?? payload.data.shortBio ?? null,
    };
  },

  getSeatMap: async (concertId: string): Promise<SeatMapResponse> => {
    const response = await apiClient.get(`/concerts/${concertId}/seat-map`);
    return response.data.data;
  },

  getAvailability: async (concertId: string): Promise<PublicTicketType[]> => {
    const response = await apiClient.get(`/concerts/${concertId}/ticket-types/availability`);
    return response.data.data;
  },

  getMyOrders: async (): Promise<OrderSummary[]> => {
    const response = await apiClient.get('/orders/me');
    return response.data.data;
  },

  getMyTickets: async (): Promise<TicketSummary[]> => {
    const response = await apiClient.get('/tickets/me');
    return response.data.data;
  },

  createOrder: async (data: CreateOrderPayload, idempotencyKey: string): Promise<{ id: string }> => {
    const response = await apiClient.post('/orders', data, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return response.data.data;
  },

  initiatePayment: async (orderId: string, idempotencyKey: string): Promise<PaymentInitiationResult> => {
    const response = await apiClient.post(`/payments/${orderId}/initiate`, null, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return response.data.data ?? response.data;
  },
};
