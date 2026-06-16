import { create } from 'zustand';

type AuthUser = Record<string, unknown>;

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (userData: AuthUser, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (userData, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
    set({ user: userData, isAuthenticated: true });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
    set({ user: null, isAuthenticated: false });
  },
}));

export const hasStoredAccessToken = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('access_token'));
};
