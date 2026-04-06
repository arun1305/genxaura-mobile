import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../services/api';
import { socketService } from '../sockets/socketService';

interface User {
  _id: string;
  email?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboarded: boolean;

  // Actions
  loginWithPhone: (phone: string, idToken: string) => Promise<{ isNew: boolean }>;
  loginWithGoogle: (idToken: string) => Promise<{ isNew: boolean }>;
  loginWithApple: (idToken: string, fullName?: string, email?: string) => Promise<{ isNew: boolean }>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: User) => void;
  setOnboarded: (value: boolean) => void;
  hydrate: () => Promise<void>;
  updateFcmToken: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  isOnboarded: false,

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, userStr, isOnboarded] = await Promise.all([
        SecureStore.getItemAsync('accessToken'),
        SecureStore.getItemAsync('refreshToken'),
        SecureStore.getItemAsync('user'),
        SecureStore.getItemAsync('isOnboarded'),
      ]);

      if (accessToken && userStr) {
        const user = JSON.parse(userStr);
        set({
          accessToken,
          refreshToken,
          user,
          isAuthenticated: true,
          isOnboarded: isOnboarded === 'true',
        });
        await socketService.connect();
      }
    } catch (err) {
      console.error('[AuthStore] Hydration error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  setTokens: async (accessToken, refreshToken) => {
    await Promise.all([
      SecureStore.setItemAsync('accessToken', accessToken),
      SecureStore.setItemAsync('refreshToken', refreshToken),
    ]);
    set({ accessToken, refreshToken });
  },

  setUser: (user) => {
    SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user });
  },

  setOnboarded: (value) => {
    SecureStore.setItemAsync('isOnboarded', String(value));
    set({ isOnboarded: value });
  },

  loginWithPhone: async (phone, idToken) => {
    const { data } = await authApi.loginWithPhone(phone, idToken);
    const { tokens, isNew } = data.data;
    await get().setTokens(tokens.accessToken, tokens.refreshToken);
    set({ isAuthenticated: true });
    await socketService.connect();
    return { isNew };
  },

  loginWithGoogle: async (idToken) => {
    const { data } = await authApi.loginWithGoogle(idToken);
    const { tokens, isNew } = data.data;
    await get().setTokens(tokens.accessToken, tokens.refreshToken);
    set({ isAuthenticated: true });
    await socketService.connect();
    return { isNew };
  },

  loginWithApple: async (idToken, fullName, email) => {
    const { data } = await authApi.loginWithApple(idToken, fullName, email);
    const { tokens, isNew } = data.data;
    await get().setTokens(tokens.accessToken, tokens.refreshToken);
    set({ isAuthenticated: true });
    await socketService.connect();
    return { isNew };
  },

  loginWithEmail: async (email, password) => {
    const { data } = await authApi.loginWithEmail(email, password);
    const { tokens } = data.data;
    await get().setTokens(tokens.accessToken, tokens.refreshToken);
    set({ isAuthenticated: true });
    await socketService.connect();
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch { /* ignore */ }
    socketService.disconnect();
    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('user'),
      SecureStore.deleteItemAsync('isOnboarded'),
    ]);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isOnboarded: false,
    });
  },

  updateFcmToken: async (token) => {
    try {
      await authApi.updateFcmToken(token);
    } catch { /* ignore */ }
  },
}));
