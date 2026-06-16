export const ADMIN_ACCESS_TOKEN_KEY = 'admin_access_token';
export const ADMIN_REFRESH_TOKEN_KEY = 'admin_refresh_token';

export const getStoredAdminAccessToken = (): string | null => {
  if (globalThis.window === undefined) return null;
  return localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
};

export const hasStoredAdminAccessToken = (): boolean => {
  return Boolean(getStoredAdminAccessToken());
};

export const getStoredAdminRefreshToken = (): string | null => {
  if (globalThis.window === undefined) return null;
  return localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
};

export const hasStoredAdminSession = (): boolean => {
  return Boolean(getStoredAdminAccessToken() || getStoredAdminRefreshToken());
};

export const setStoredAdminTokens = (accessToken: string, refreshToken?: string): void => {
  if (globalThis.window === undefined) return;

  localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const clearStoredAdminTokens = (): void => {
  if (globalThis.window === undefined) return;

  localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
};
