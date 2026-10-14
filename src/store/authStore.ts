import { create } from 'zustand';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import auth from '@react-native-firebase/auth';
import {
  authApi,
  setSessionHandlers,
  AuthUser,
  AuthResponseData,
  AuthFailureReason,
} from '../services/api';
import { socketService } from '../sockets/socketService';
import { signOutSocialProviders } from '../services/socialAuth';
import { stopEmergencyLocationTracking } from '../services/emergencyShareTracker';
import { resetLocationThrottle } from '../services/locationService';
import { clearPendingNotification } from '../services/notificationService';
import { useChatStore } from './chatStore';
import { useSwipeStore } from './swipeStore';
import { useUserStore } from './userStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useNotificationStore } from './notificationStore';

export type { AuthUser } from '../services/api';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboarded: boolean;

  // Actions
  loginWithPhone: (phone: string, idToken: string) => Promise<{ isNew: boolean }>;
  loginWithGoogle: (idToken: string) => Promise<{ isNew: boolean }>;
  loginWithApple: (idToken: string, fullName?: string) => Promise<{ isNew: boolean }>;
  loginWithEmail: (email: string, password: string) => Promise<{ isNew: boolean }>;
  register: (email: string, password: string) => Promise<{ isNew: boolean }>;
  /** Ends the session. `reason` is set for forced logouts (shows a message). */
  logout: (reason?: AuthFailureReason) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: AuthUser) => void;
  setOnboarded: (value: boolean) => void;
  hydrate: () => Promise<void>;
  updateFcmToken: (token: string) => Promise<void>;
}

// ── Session lifecycle (socket + global listeners) ───────────────────
let sessionCleanup: (() => void) | null = null;
let loggingOut = false;

function startSession(userId?: string | null) {
  if (userId) useChatStore.getState().setMyUserId(userId);
  // Global chat listeners are attached once per session — not per screen —
  // so chats opened from a match popup / push notification receive messages.
  if (!sessionCleanup) sessionCleanup = useChatStore.getState().initSocketListeners();
  socketService.connect().catch((err) => console.warn('[AuthStore] socket connect failed:', err));
}

function endSession() {
  sessionCleanup?.();
  sessionCleanup = null;
  socketService.disconnect();
}

function resetAllStores() {
  useChatStore.getState().reset();
  useSwipeStore.getState().reset();
  useUserStore.getState().reset();
  useSubscriptionStore.getState().reset();
  useNotificationStore.getState().reset();
}

export const useAuthStore = create<AuthState>((set, get) => {
  /** Shared handling for every auth response (login/register/phone/google/apple). */
  const applyAuthResponse = async (data: AuthResponseData) => {
    const { tokens, user, isNew } = data;
    await get().setTokens(tokens.accessToken, tokens.refreshToken);
    get().setUser(user);
    get().setOnboarded(!!user?.isOnboarded);
    set({ isAuthenticated: true });
    startSession(user?.id);
    return { isNew: !!isNew };
  };

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    isOnboarded: false,

    hydrate: async () => {
      try {
        const [accessToken, refreshToken, userStr, isOnboardedStr] = await Promise.all([
          SecureStore.getItemAsync('accessToken'),
          SecureStore.getItemAsync('refreshToken'),
          SecureStore.getItemAsync('user'),
          SecureStore.getItemAsync('isOnboarded'),
        ]);

        // A session exists whenever we hold tokens — the stored user is optional
        // (older builds never persisted it).
        if (accessToken && refreshToken) {
          let user: AuthUser | null = null;
          try {
            user = userStr ? JSON.parse(userStr) : null;
          } catch {
            user = null;
          }

          set({
            accessToken,
            refreshToken,
            user,
            isAuthenticated: true,
            isOnboarded: isOnboardedStr === 'true' || !!user?.isOnboarded,
          });
          startSession(user?.id);

          // Refresh state from the server (also refreshes an expired token, or
          // logs out if the session is no longer valid).
          const profile = await useUserStore.getState().loadProfile();
          if (!get().isAuthenticated) return;

          if (profile) {
            if (!user && profile.userId) {
              get().setUser({ id: profile.userId, isOnboarded: !!profile.isOnboarded });
            }
            get().setOnboarded(!!profile.isOnboarded);
          } else if (useUserStore.getState().profileMissing) {
            get().setOnboarded(false);
          }
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
      SecureStore.setItemAsync('user', JSON.stringify(user)).catch(() => undefined);
      set({ user });
      if (user?.id) useChatStore.getState().setMyUserId(user.id);
    },

    setOnboarded: (value) => {
      SecureStore.setItemAsync('isOnboarded', String(value)).catch(() => undefined);
      const user = get().user;
      if (user && user.isOnboarded !== value) {
        const next = { ...user, isOnboarded: value };
        SecureStore.setItemAsync('user', JSON.stringify(next)).catch(() => undefined);
        set({ user: next, isOnboarded: value });
      } else {
        set({ isOnboarded: value });
      }
    },

    loginWithPhone: async (phone, idToken) => {
      const { data } = await authApi.loginWithPhone(phone, idToken);
      return applyAuthResponse(data.data);
    },

    loginWithGoogle: async (idToken) => {
      const { data } = await authApi.loginWithGoogle(idToken);
      return applyAuthResponse(data.data);
    },

    loginWithApple: async (idToken, fullName) => {
      // Email is intentionally not sent: the backend ignores it for account lookup.
      const { data } = await authApi.loginWithApple(idToken, fullName);
      return applyAuthResponse(data.data);
    },

    loginWithEmail: async (email, password) => {
      const { data } = await authApi.loginWithEmail(email, password);
      return applyAuthResponse(data.data);
    },

    register: async (email, password) => {
      const { data } = await authApi.register(email, password);
      return applyAuthResponse(data.data);
    },

    logout: async (reason) => {
      if (loggingOut) return;
      loggingOut = true;
      try {
        // 1. Tell the server (clears refresh + FCM token). Best effort.
        if (get().accessToken || (await SecureStore.getItemAsync('accessToken'))) {
          await authApi.logout().catch(() => undefined);
        }

        // 2. Sign out of Firebase / social providers.
        try {
          if (auth().currentUser) await auth().signOut();
        } catch {
          /* ignore */
        }
        await signOutSocialProviders();

        // 3. Socket, global listeners and background timers.
        endSession();
        stopEmergencyLocationTracking();
        resetLocationThrottle();
        clearPendingNotification();

        // 4. Local credentials.
        await Promise.all([
          SecureStore.deleteItemAsync('accessToken'),
          SecureStore.deleteItemAsync('refreshToken'),
          SecureStore.deleteItemAsync('user'),
          SecureStore.deleteItemAsync('isOnboarded'),
        ]).catch(() => undefined);

        // 5. Every store — no data from this account may leak into the next one.
        resetAllStores();

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isOnboarded: false,
          isLoading: false,
        });
      } finally {
        loggingOut = false;
      }

      if (reason === 'suspended') {
        Alert.alert(
          'Account suspended',
          'Your account has been suspended and you have been logged out. If you think this is a mistake, please contact support.',
        );
      } else if (reason === 'expired') {
        Alert.alert('Session expired', 'Please log in again.');
      }
    },

    updateFcmToken: async (token) => {
      try {
        await authApi.updateFcmToken(token);
      } catch { /* ignore */ }
    },
  };
});

// ── Wire API/socket session events to this store ─────────────────────
setSessionHandlers({
  onTokensRefreshed: (tokens, user) => {
    useAuthStore.setState({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    if (user) {
      useAuthStore.getState().setUser(user);
    }
  },
  onAuthFailure: (reason) => {
    const { isAuthenticated, logout } = useAuthStore.getState();
    if (!isAuthenticated) return;
    logout(reason);
  },
});
