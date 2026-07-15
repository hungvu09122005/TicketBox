import { apiClient } from '../api-client';
import type { TicketTypeAvailability } from '../types';

export interface AudienceTicketType {
  id: string;
  name: string;
  price: number;
  maxPerUser: number;
  soldQuantity?: number;
  heldQuantity?: number;
  totalQuantity?: number;
}

export const ticketTypesService = {
  getByConcert: async (concertId: string): Promise<AudienceTicketType[]> => {
    const response = await apiClient.get(`/concerts/${concertId}/ticket-types`);
    return response.data.data;
  },

  getAvailability: async (concertId: string): Promise<TicketTypeAvailability[]> => {
    const response = await apiClient.get(`/concerts/${concertId}/ticket-types/availability`);
    return response.data.data;
  },
};

