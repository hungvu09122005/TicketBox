import { getStoredAccessToken } from '../auth-session';
import { apiClient } from '../api-client';
import { unwrapApiData, unwrapApiList } from '../api-response';
import {
  CreateOrderPayload,
  QueuedCheckoutResponse,
  PaymentInitiationResult,
  OrderSummary,
  PublicArtistDetail,
  PublicConcert,
  PublicTicketType,
  SeatMapResponse,
  TicketSummary,
} from '../types';

export const concertService = {
  getPublishedConcerts: async (): Promise<PublicConcert[]> => {
    const response = await apiClient.get('/concerts');
    return unwrapApiList<PublicConcert>(response.data);
  },

  getConcert: async (id: string): Promise<PublicConcert> => {
    const response = await apiClient.get(`/concerts/${id}`);
    return unwrapApiData<PublicConcert>(response.data);
  },

  getArtist: async (artistId: string): Promise<PublicArtistDetail> => {
    const accessToken = getStoredAccessToken();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/artists/${artistId}`, {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    const bodyText = await response.text();

    if (!response.ok) {
      throw Object.assign(new Error(`Failed to load artist detail: ${response.status}`), {
        response: {
          status: response.status,
          bodyText,
        },
      });
    }

    if (!bodyText.trim() || bodyText.trim() === 'null') {
      throw new Error('Artist detail response was empty.');
    }

    const payload = JSON.parse(bodyText) as { data: PublicArtistDetail };
    return {
      ...payload.data,
      description: payload.data.description ?? payload.data.shortBio ?? null,
    };
  },

  getSeatMap: async (concertId: string): Promise<SeatMapResponse> => {
    const response = await apiClient.get(`/concerts/${concertId}/seat-map`);
    return unwrapApiData<SeatMapResponse>(response.data);
  },

  getAvailability: async (concertId: string): Promise<PublicTicketType[]> => {
    const response = await apiClient.get(`/concerts/${concertId}/ticket-types/availability`);
    return unwrapApiList<PublicTicketType>(response.data);
  },

  getMyOrders: async (): Promise<OrderSummary[]> => {
    const response = await apiClient.get('/orders/me');
    return unwrapApiList<OrderSummary>(response.data);
  },

  getMyTickets: async (): Promise<TicketSummary[]> => {
    const response = await apiClient.get('/tickets/me');
    return unwrapApiList<TicketSummary>(response.data);
  },

  createOrder: async (data: CreateOrderPayload, idempotencyKey: string): Promise<{ id: string } | QueuedCheckoutResponse> => {
    const response = await apiClient.post('/orders', data, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return unwrapApiData<{ id: string } | QueuedCheckoutResponse>(response.data);
  },

  initiatePayment: async (orderId: string, idempotencyKey: string): Promise<PaymentInitiationResult> => {
    const response = await apiClient.post(`/payments/${orderId}/initiate`, undefined, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return unwrapApiData<PaymentInitiationResult>(response.data);
  },
};
