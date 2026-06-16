import axios from 'axios';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearStoredAuthSession,
  getStoredRefreshToken,
} from './auth-session';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  // Add auth token logic here if available in local storage
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

const refreshClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as any;
    const status = error.response?.status;

    if (
      typeof window === 'undefined' ||
      status !== 401 ||
      originalRequest?._retry ||
      !originalRequest?.url ||
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/register') ||
      originalRequest.url.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearStoredAuthSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshResponse = await refreshClient.post('/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: nextRefreshToken } = refreshResponse.data as {
        accessToken: string;
        refreshToken: string;
      };

      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }

      return apiClient(originalRequest);
    } catch (refreshError) {
      clearStoredAuthSession();
      if (window.location.pathname !== '/login') {
        window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
      return Promise.reject(refreshError);
    }
  },
);
