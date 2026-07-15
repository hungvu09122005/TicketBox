import { apiClient } from '../api-client';
import type { AdminProfile } from '../auth.types';
import { Concert, Artist, SeatMapResponse, TicketType } from '../types';

const isRetryableListError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return true;
  }

  const status = (error as { response?: { status?: number } }).response?.status;
  return typeof status === 'number' ? status >= 500 : true;
};

export const concertService = {
  isSystemAdmin: (profile?: Pick<AdminProfile, 'roles'> | null): boolean => {
    return profile?.roles?.includes('SYSTEM_ADMIN') ?? false;
  },

  getConcerts: async (profile?: Pick<AdminProfile, 'roles'> | null): Promise<Concert[]> => {
    const isSystemAdmin = concertService.isSystemAdmin(profile);
    const endpoints = isSystemAdmin
      ? ['/concerts/admin', '/concerts/organizer/me', '/concerts']
      : ['/concerts/organizer/me', '/concerts'];

    let lastError: unknown = null;

    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.get(endpoint);
        if (endpoint !== endpoints[0]) {
          console.warn(`concertService.getConcerts fell back to ${endpoint} after a failure on ${endpoints[0]}`);
        }
        return response.data.data;
      } catch (error) {
        lastError = error;
        if (!isRetryableListError(error)) {
          throw error;
        }
      }
    }

    throw lastError;
  },
  
  getConcert: async (id: string): Promise<Concert> => {
    const response = await apiClient.get(`/concerts/${id}`);
    return response.data.data;
  },
  
  createConcert: async (data: Partial<Concert>): Promise<Concert> => {
    const response = await apiClient.post('/concerts', data);
    return response.data.data;
  },
  
  updateConcert: async (profile: Pick<AdminProfile, 'roles'> | null | undefined, id: string, data: Partial<Concert>): Promise<void> => {
    const endpoints = concertService.isSystemAdmin(profile)
      ? [`/concerts/admin/${id}`, `/concerts/${id}`]
      : [`/concerts/${id}`, `/concerts/admin/${id}`];

    let lastError: unknown = null;

    for (const endpoint of endpoints) {
      try {
        await apiClient.patch(endpoint, data);
        return;
      } catch (error) {
        lastError = error;
        const status = typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

        if (status !== 403 && status !== 404) {
          throw error;
        }
      }
    }

    throw lastError;
  },
  
  publishConcert: async (profile: Pick<AdminProfile, 'roles'> | null | undefined, id: string): Promise<void> => {
    const endpoint = concertService.isSystemAdmin(profile) ? `/concerts/admin/${id}/publish` : `/concerts/${id}/publish`;
    await apiClient.post(endpoint);
  },

  cancelConcert: async (profile: Pick<AdminProfile, 'roles'> | null | undefined, id: string): Promise<void> => {
    const endpoint = concertService.isSystemAdmin(profile) ? `/concerts/admin/${id}/cancel` : `/concerts/${id}/cancel`;
    await apiClient.post(endpoint);
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
    const response = await apiClient.get(`/concerts/${concertId}/seat-map/admin`);
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
