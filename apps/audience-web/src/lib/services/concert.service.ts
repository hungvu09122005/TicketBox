import { apiClient } from '../api-client';
import { PublicConcert } from '../types';

export const concertService = {
  getPublishedConcerts: async (): Promise<PublicConcert[]> => {
    const response = await apiClient.get('/concerts');
    return response.data.data;
  },
};
