import axios from 'axios';
import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens,
} from './auth-session';
import { useAuthStore } from './auth-store';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getStoredAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      const refreshToken = getStoredRefreshToken();
      const requestUrl = String(originalRequest.url ?? '');

      if (
        refreshToken &&
        !requestUrl.includes('/auth/login') &&
        !requestUrl.includes('/auth/register') &&
        !requestUrl.includes('/auth/refresh')
      ) {
        originalRequest._retry = true;

        try {
          const refreshResponse = await refreshClient.post('/auth/refresh', {
            refreshToken,
          });

          const { accessToken, refreshToken: nextRefreshToken } = refreshResponse.data.data as {
            accessToken: string;
            refreshToken: string;
          };

          setStoredTokens(accessToken, nextRefreshToken);
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          clearStoredTokens();
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined') {
            window.location.assign('/login');
          }
          return Promise.reject(refreshError);
        }
      }

      clearStoredTokens();
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    }

    if (status === 403 && typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname !== '/forbidden') {
        window.location.assign('/forbidden');
      }
    }

    return Promise.reject(error);
  },
);
