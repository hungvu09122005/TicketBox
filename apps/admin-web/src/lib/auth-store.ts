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
    }
    set({ admin: null, isAuthenticated: false });
  },
}));
