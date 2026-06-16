import { create } from 'zustand';
import { clearStoredAuthSession, hasStoredAccessToken as hasStoredAccessTokenInSession, setStoredAuthTokens } from './auth-session';

type AuthUser = Record<string, unknown>;

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (userData: AuthUser, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: hasStoredAccessTokenInSession(),
  login: (userData, token) => {
    setStoredAuthTokens(token);
    set({ user: userData, isAuthenticated: true });
  },
  logout: () => {
    clearStoredAuthSession();
    set({ user: null, isAuthenticated: false });
  },
}));

export const hasStoredAccessToken = (): boolean => {
  return hasStoredAccessTokenInSession();
};
