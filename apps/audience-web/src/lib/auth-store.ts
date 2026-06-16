import { create } from 'zustand';
import { clearStoredTokens, setStoredTokens } from './auth-session';
import type { AudienceProfile } from './auth.types';

interface AuthState {
  user: AudienceProfile | null;
  permissions: string[];
  isAuthenticated: boolean;
  login: (userData: AudienceProfile, token: string, refreshToken?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permissions: [],
  isAuthenticated: false,
  login: (userData, token, refreshToken) => {
    setStoredTokens(token, refreshToken);
    set({
      user: userData,
      permissions: userData.permissions ?? [],
      isAuthenticated: true,
    });
  },
  logout: () => {
    clearStoredTokens();
    set({ user: null, permissions: [], isAuthenticated: false });
  },
}));

export { hasStoredSession, hasStoredAccessToken } from './auth-session';
