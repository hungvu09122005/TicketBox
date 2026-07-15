import { apiClient } from '../api-client';
import { Artist } from '../types';

export const artistService = {
  getArtists: async (): Promise<Artist[]> => {
    const response = await apiClient.get('/artists');
    return response.data.data;
  },

  createArtist: async (data: Partial<Artist>): Promise<Artist> => {
    const response = await apiClient.post('/artists', data);
    return response.data.data;
  },

  getArtist: async (id: string): Promise<Artist> => {
    const response = await apiClient.get(`/artists/${id}`);
    return response.data.data;
  },

  updateArtist: async (id: string, data: Partial<Artist>): Promise<Artist> => {
    const response = await apiClient.patch(`/artists/${id}`, data);
    return response.data.data;
  },

  uploadAvatarAsset: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/storage/test-upload', formData);
    return (response.data.data?.objectName ?? response.data.objectName) as string;
  },
};
