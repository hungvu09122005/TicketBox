import { apiClient } from '../api-client';
import { Concert, Artist, SeatMapResponse, TicketType } from '../types';

export const concertService = {
  getConcerts: async (): Promise<Concert[]> => {
    const response = await apiClient.get('/concerts/organizer/me');
    return response.data.data;
  },
  
  getConcert: async (id: string): Promise<Concert> => {
    const response = await apiClient.get(`/concerts/${id}`);
    return response.data.data;
  },
  
  createConcert: async (data: Partial<Concert>): Promise<Concert> => {
    const response = await apiClient.post('/concerts', data);
    return response.data.data;
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

  uploadBannerAsset: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/storage/test-upload', formData);
    return (response.data.data?.objectName ?? response.data.objectName) as string;
  },

  // Metadata loaders for form
  getArtists: async (): Promise<Artist[]> => {
    const response = await apiClient.get('/artists');
    return response.data.data;
  },

  getTicketTypes: async (concertId: string): Promise<TicketType[]> => {
    const response = await apiClient.get(`/concerts/${concertId}/ticket-types`);
    return response.data.data;
  },

  createTicketType: async (concertId: string, data: Partial<TicketType>): Promise<TicketType> => {
    const response = await apiClient.post(`/concerts/${concertId}/ticket-types`, data);
    return response.data.data;
  },

  updateTicketType: async (concertId: string, ticketTypeId: string, data: Partial<TicketType>): Promise<TicketType> => {
    const response = await apiClient.patch(`/concerts/${concertId}/ticket-types/${ticketTypeId}`, data);
    return response.data.data;
  },

  getSeatMap: async (concertId: string): Promise<SeatMapResponse> => {
    const response = await apiClient.get(`/concerts/${concertId}/seat-map`);
    return response.data.data;
  },

  uploadSeatMap: async (concertId: string, file: File, mapping: Record<string, string>): Promise<SeatMapResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));

    const response = await apiClient.post(`/concerts/${concertId}/seat-map/upload`, formData);

    return response.data.data;
  },

};
