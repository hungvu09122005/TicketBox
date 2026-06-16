import { apiClient } from '../api-client';
import { Concert, Artist } from '../types';

export const concertService = {
  getConcerts: async (): Promise<Concert[]> => {
    const response = await apiClient.get('/concerts/organizer/me');
    return response.data;
  },
  
  getConcert: async (id: string): Promise<Concert> => {
    const response = await apiClient.get(`/concerts/${id}`);
    return response.data;
  },
  
  createConcert: async (data: Partial<Concert>): Promise<Concert> => {
    const response = await apiClient.post('/concerts', data);
    return response.data;
  },
  
  updateConcert: async (id: string, data: Partial<Concert>): Promise<void> => {
    await apiClient.patch(`/concerts/${id}`, data);
  },
  
  publishConcert: async (id: string): Promise<void> => {
    await apiClient.post(`/concerts/${id}/publish`);
  },

  cancelConcert: async (id: string): Promise<void> => {
    await apiClient.post(`/concerts/${id}/cancel`);
  },

  // Metadata loaders for form
  getArtists: async (): Promise<Artist[]> => {
    const response = await apiClient.get('/artists');
    return response.data;
  },

};
