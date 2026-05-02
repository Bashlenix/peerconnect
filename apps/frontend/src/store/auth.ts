import { create } from "zustand";
import type { AuthUser } from "../api/auth";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  setAuth: (user) => set({ isAuthenticated: true, isLoading: false, user }),
  clearAuth: () => set({ isAuthenticated: false, isLoading: false, user: null }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
