import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearStoredAdminTokens,
  getStoredAdminAccessToken,
  getStoredAdminRefreshToken,
  setStoredAdminTokens,
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
  if (globalThis.window !== undefined) {
    const token = getStoredAdminAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
    const headers = config.headers as {
      set?: (name: string, value: string | undefined) => void;
      [key: string]: unknown;
    };

    if (typeof headers.set === 'function') {
      headers.set('Content-Type', undefined);
      headers.set('content-type', undefined);
    } else {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
  }

  return config;
});

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const handleUnauthorized = async (error: AxiosError, originalRequest: CustomAxiosRequestConfig) => {
  const refreshToken = getStoredAdminRefreshToken();
  const requestUrl = String(originalRequest.url ?? '');

  if (
    refreshToken &&
    !requestUrl.includes('/auth/login') &&
    !requestUrl.includes('/auth/register') &&
    !requestUrl.includes('/auth/refresh')
  ) {
    originalRequest._retry = true;

    try {
      const refreshResponse = await refreshClient.post('/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: nextRefreshToken } = refreshResponse.data.data as {
        accessToken: string;
        refreshToken: string;
      };

      setStoredAdminTokens(accessToken, nextRefreshToken);
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      return redirectToLogin(refreshError);
    }
  }

  return redirectToLogin(error);
};

const redirectToLogin = (error: unknown) => {
  clearStoredAdminTokens();
  useAuthStore.getState().logout();
  if (globalThis.window !== undefined) {
    globalThis.window.location.assign('/login');
  }
  throw error;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if (status === 401 && originalRequest && !(originalRequest as CustomAxiosRequestConfig)._retry) {
      return handleUnauthorized(error, originalRequest as CustomAxiosRequestConfig);
    }

    if (status === 403 && globalThis.window !== undefined) {
      const pathname = globalThis.window.location.pathname;
      if (pathname !== '/forbidden') {
        globalThis.window.location.assign('/forbidden');
      }
    }

    throw error;
  },
);
