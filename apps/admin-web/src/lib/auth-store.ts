import { create } from 'zustand';
import { buildAdminSessionFromToken, clearStoredAdminSession, readStoredAdminSession, ADMIN_ACCESS_TOKEN_KEY } from './auth-session';

interface AuthState {
  admin: {
    id: string;
    email: string;
    roles: string[];
    permissionVersion: number;
    permissions: string[];
  } | null;
  isAuthenticated: boolean;
  login: (adminData: { email: string }, token: string) => void;
  logout: () => void;
}

const initialSession = readStoredAdminSession();

export const useAuthStore = create<AuthState>((set) => ({
  admin: initialSession,
  isAuthenticated: Boolean(initialSession),
  login: (adminData, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, token);
    }
    const session = buildAdminSessionFromToken(token, adminData.email);
    set({ admin: session, isAuthenticated: true });
  },
  logout: () => {
    clearStoredAdminSession();
    set({ admin: null, isAuthenticated: false });
  },
}));

export const hasStoredAdminAccessToken = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY));
};
