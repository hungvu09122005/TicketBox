import { apiClient } from '../api-client';
import type { AudienceTicket } from '../types';

export const ticketsService = {
  getMyTickets: async (): Promise<AudienceTicket[]> => {
    const response = await apiClient.get('/tickets/me');
    return response.data.data;
  },
};

