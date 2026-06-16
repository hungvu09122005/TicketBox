import { create } from 'zustand';

interface AuthState {
  admin: any | null;
  isAuthenticated: boolean;
  login: (adminData: any, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  admin: null,
  isAuthenticated: false,
  login: (adminData, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_access_token', token);
    }
    set({ admin: adminData, isAuthenticated: true });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
    }
    set({ admin: null, isAuthenticated: false });
  },
}));

export const hasStoredAdminAccessToken = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('admin_access_token'));
};
