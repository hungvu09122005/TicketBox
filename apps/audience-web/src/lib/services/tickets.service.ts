import { apiClient } from '../api-client';
import { unwrapApiList } from '../api-response';
import type { AudienceTicket } from '../types';

export const ticketsService = {
  getMyTickets: async (): Promise<AudienceTicket[]> => {
    const response = await apiClient.get('/tickets/me');
    return unwrapApiList<AudienceTicket>(response.data);
  },
};
