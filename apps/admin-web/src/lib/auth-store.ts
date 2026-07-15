import { create } from 'zustand';
import { clearStoredAdminTokens, setStoredAdminTokens } from './auth-session';
import type { AdminProfile } from './auth.types';

interface AuthState {
  admin: AdminProfile | null;
  permissions: string[];
  isAuthenticated: boolean;
  login: (adminData: AdminProfile, token: string, refreshToken?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  admin: null,
  permissions: [],
  isAuthenticated: false,
  login: (adminData, token, refreshToken) => {
    setStoredAdminTokens(token, refreshToken);
    set({
      admin: adminData,
      permissions: adminData.permissions ?? [],
      isAuthenticated: true,
    });
  },
  logout: () => {
    clearStoredAdminTokens();
    set({ admin: null, permissions: [], isAuthenticated: false });
  },
}));

export { hasStoredAdminSession, hasStoredAdminAccessToken } from './auth-session';
