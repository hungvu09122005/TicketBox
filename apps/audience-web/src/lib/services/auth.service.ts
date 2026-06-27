import { apiClient } from '../api-client';
import type { AudienceProfile } from '../auth.types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  app?: 'audience' | 'admin';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthActionResponse {
  success: boolean;
  message: string;
}

export interface ForgotPasswordPayload {
  email: string;
  app?: 'audience' | 'admin';
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthTokens> => {
    const response = await apiClient.post('/auth/login', payload);
    return response.data.data;
  },

  register: async (payload: RegisterPayload): Promise<AuthActionResponse> => {
    const response = await apiClient.post('/auth/register', payload);
    return response.data.data;
  },

  forgotPassword: async (payload: ForgotPasswordPayload): Promise<AuthActionResponse> => {
    const response = await apiClient.post('/auth/forgot-password', payload);
    return response.data.data;
  },

  resetPassword: async (payload: ResetPasswordPayload): Promise<AuthActionResponse> => {
    const response = await apiClient.post('/auth/reset-password', payload);
    return response.data.data;
  },

  activateAccount: async (token: string): Promise<AuthActionResponse> => {
    const response = await apiClient.post('/auth/activate-account', { token });
    return response.data.data;
  },

  me: async (): Promise<AudienceProfile> => {
    const response = await apiClient.get('/users/me');
    return response.data.data;
  },
};
