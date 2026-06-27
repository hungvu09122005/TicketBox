import { apiClient } from '../api-client';
import type { AdminProfile } from '../auth.types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  app?: 'audience' | 'admin';
}

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthTokens> => {
    const response = await apiClient.post('/auth/login', payload);
    return response.data.data;
  },

  register: async (payload: RegisterPayload): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/register', payload);
    return response.data.data;
  },

  forgotPassword: async (payload: { email: string; app?: 'audience' | 'admin' }): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/forgot-password', payload);
    return response.data.data;
  },

  resetPassword: async (payload: { token: string; password: string }): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/reset-password', payload);
    return response.data.data;
  },

  activateAccount: async (token: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/activate-account', { token });
    return response.data.data;
  },

  me: async (): Promise<AdminProfile> => {
    const response = await apiClient.get('/users/me');
    return response.data.data;
  },
};
