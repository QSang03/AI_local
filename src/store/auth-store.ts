import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at?: string;
}

interface AuthStore {
  user: AuthUser | null;
  isReady: boolean;
  setUser: (user: AuthUser | null) => void;
  setReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isReady: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ isReady: ready }),
}));
