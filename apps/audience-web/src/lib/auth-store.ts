import { create } from 'zustand';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  login: (userData: any, token: string) => void;
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
