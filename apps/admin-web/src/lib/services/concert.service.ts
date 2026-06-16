import { apiClient } from '../api-client';
import { Concert, Artist, Venue } from '../types';

export const concertService = {
  getConcerts: async (): Promise<Concert[]> => {
    const response = await apiClient.get('/concerts');
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
  
  updateConcert: async (id: string, data: Partial<Concert>): Promise<Concert> => {
    const response = await apiClient.put(`/concerts/${id}`, data);
    return response.data;
  },
  
  updateStatus: async (id: string, status: 'PUBLISHED' | 'CANCELLED'): Promise<Concert> => {
    const response = await apiClient.patch(`/concerts/${id}/status`, { status });
    return response.data;
  },

  // Metadata loaders for form
  getArtists: async (): Promise<Artist[]> => {
    const response = await apiClient.get('/artists');
    return response.data;
  },

  getVenues: async (): Promise<Venue[]> => {
    const response = await apiClient.get('/venues');
    return response.data;
  }
};
