import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Internal: request already retried after a token refresh */
    _retry?: boolean;
    /** Internal: never attempt a token refresh for this request (e.g. logout) */
    _skipAuthRefresh?: boolean;
  }
}

const BASE_URL = API_BASE_URL;

// ── Shared types ──────────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  isAdmin?: boolean;
  isOnboarded?: boolean;
}

export interface AuthResponseData {
  tokens: AuthTokens;
  isNew?: boolean;
  user: AuthUser;
}

/** Proof of payment required by every purchase endpoint. */
export interface PurchaseProof {
  platform: 'ios' | 'android';
  receipt: string;
  transactionId: string;
}

export type AuthFailureReason = 'expired' | 'suspended';

/** Thrown when the session could not be refreshed and the user has been logged out. */
export class SessionEndedError extends Error {
  reason: AuthFailureReason;
  constructor(reason: AuthFailureReason) {
    super(reason === 'suspended' ? 'Account suspended' : 'Session expired');
    this.name = 'SessionEndedError';
    this.reason = reason;
  }
}

// ── Error helpers ─────────────────────────────────────────────────────
export function getErrorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

export function isSuspendedError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const data = err.response?.data as { error?: string } | undefined;
  return err.response?.status === 403 && data?.error === 'ACCOUNT_SUSPENDED';
}

/** User-facing message from a Nest error ({ statusCode, message: string|string[], error }). */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'Could not reach the server. Check your internet connection and try again.';
    }
    const data = err.response.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg) && msg.length > 0) return msg.join('\n');
    if (typeof msg === 'string' && msg.trim()) return msg;
    return fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ── Session hooks (registered by authStore; avoids a circular import) ─
interface SessionHandlers {
  onTokensRefreshed?: (tokens: AuthTokens, user?: AuthUser) => void;
  onAuthFailure?: (reason: AuthFailureReason) => void;
}

let sessionHandlers: SessionHandlers = {};

export function setSessionHandlers(handlers: SessionHandlers): void {
  sessionHandlers = handlers;
}

/** Ends the session (logout + message). Safe to call multiple times. */
export function notifyAuthFailure(reason: AuthFailureReason): void {
  sessionHandlers.onAuthFailure?.(reason);
}

// Single in-flight refresh shared by every caller (REST interceptor, socket).
let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) {
    notifyAuthFailure('expired');
    throw new SessionEndedError('expired');
  }
  try {
    // Plain axios: must not go through the interceptors below.
    const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15000 });
    const { tokens, user } = data.data as AuthResponseData;
    await Promise.all([
      SecureStore.setItemAsync('accessToken', tokens.accessToken),
      SecureStore.setItemAsync('refreshToken', tokens.refreshToken),
    ]);
    sessionHandlers.onTokensRefreshed?.(tokens, user);
    return tokens.accessToken;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      // Server rejected the refresh token (401 reused/expired) or the account is suspended (403).
      const reason: AuthFailureReason = isSuspendedError(err) ? 'suspended' : 'expired';
      notifyAuthFailure(reason);
      throw new SessionEndedError(reason);
    }
    // Network failure: keep the session, only this attempt fails.
    throw err;
  }
}

/**
 * Refreshes the access token. Concurrent callers share one request (refresh
 * tokens are single-use, so parallel refreshes would invalidate each other).
 */
export function refreshSession(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── Axios Instance ────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – attach JWT
api.interceptors.request.use(async (config) => {
  // If a refresh is in flight, wait for it so we don't send a stale token.
  if (refreshPromise && !config._skipAuthRefresh) {
    await refreshPromise.catch(() => undefined);
  }
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_ENTRY_ENDPOINT = /\/auth\/(login|register|phone|google|apple|refresh)$/;

// Response interceptor – refresh once on 401, log out on failure / suspension
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig | undefined;
    if (!original) return Promise.reject(error);

    const isAuthEntry = AUTH_ENTRY_ENDPOINT.test(original.url ?? '');

    // Suspended account on any authenticated endpoint → forced logout.
    // (Login endpoints surface the message on the login screen instead.)
    if (isSuspendedError(error) && !isAuthEntry && !original._skipAuthRefresh) {
      notifyAuthFailure('suspended');
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original._skipAuthRefresh &&
      !isAuthEntry
    ) {
      original._retry = true;
      try {
        const accessToken = await refreshSession();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        // refreshSession already ended the session if it is unrecoverable.
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

const MULTIPART = {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 60000,
};

// ── Auth API ──────────────────────────────────────────────────────────
export const authApi = {
  loginWithPhone: (phone: string, idToken: string) =>
    api.post('/auth/phone', { phone, idToken }),

  loginWithGoogle: (idToken: string) =>
    api.post('/auth/google', { idToken }),

  loginWithApple: (idToken: string, fullName?: string) =>
    api.post('/auth/apple', { idToken, fullName }),

  loginWithEmail: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  /** Best effort; never triggers a refresh (also used during forced logout). */
  logout: () => api.post('/auth/logout', undefined, { _skipAuthRefresh: true, timeout: 5000 }),

  updateFcmToken: (fcmToken: string) =>
    api.patch('/auth/fcm-token', { fcmToken }),
};

// ── Profile API ───────────────────────────────────────────────────────
export const profileApi = {
  getMyProfile: () => api.get('/profile/me'),

  setupProfile: (data: {
    name: string;
    dob: string;
    gender: string;
    interestedIn: string[];
    bio?: string;
    interests?: string[];
    location?: { lat: number; lng: number; city?: string; country?: string };
    preferences?: {
      minAge: number;
      maxAge: number;
      maxDistance: number;
      genderPreference: string[];
    };
  }) => api.post('/profile/setup', data),

  updateProfile: (data: Partial<{
    name: string;
    bio: string;
    interests: string[];
    interestedIn: string[];
    preferences: any;
    location: any;
  }>) => api.patch('/profile', data),

  updateLocation: (lat: number, lng: number, city?: string, country?: string) =>
    api.patch('/profile/location', { lat, lng, city, country }),

  uploadPhoto: (formData: FormData) => api.post('/profile/photos', formData, MULTIPART),

  deletePhoto: (storagePath: string) =>
    api.delete(`/profile/photos/${encodeURIComponent(storagePath)}`),

  reorderPhotos: (photoOrder: string[]) =>
    api.patch('/profile/photos/reorder', { photoOrder }),

  completeOnboarding: () => api.post('/profile/onboarding/complete'),

  getProfile: (userId: string) => api.get(`/profile/${userId}`),
};

// ── Discovery API ─────────────────────────────────────────────────────
export const usersApi = {
  discover: (page = 1, limit = 20) =>
    api.get('/users/discover', { params: { page, limit } }),

  blockUser: (targetId: string) => api.post(`/users/block/${targetId}`),

  unblockUser: (targetId: string) => api.delete(`/users/block/${targetId}`),

  reportUser: (targetId: string, reason: string) =>
    api.post(`/users/report/${targetId}`, { reason }),

  getBlockedUsers: () => api.get('/users/blocked'),

  deleteAccount: () => api.delete('/users/account'),
};

// ── Swipe API ─────────────────────────────────────────────────────────
export const swipeApi = {
  swipe: (toUserId: string, type: 'like' | 'nope' | 'superlike') =>
    api.post('/swipe', { toUserId, type }),

  undoSwipe: () => api.post('/swipe/undo'),
};

// ── Match API ─────────────────────────────────────────────────────────
export const matchApi = {
  getMatches: () => api.get('/matches'),
  unmatch: (matchId: string) => api.delete(`/matches/${matchId}`),
};

// ── Chat API ──────────────────────────────────────────────────────────
export const chatApi = {
  getMessages: (matchId: string, page = 1, limit = 50) =>
    api.get(`/messages/${matchId}`, { params: { page, limit } }),

  uploadImage: (matchId: string, formData: FormData) =>
    api.post(`/messages/${matchId}/image`, formData, MULTIPART),

  deleteMessage: (messageId: string) => api.delete(`/messages/${messageId}`),
};

// ── Subscription API ──────────────────────────────────────────────────
export const subscriptionApi = {
  getStatus: () => api.get('/subscription/status'),

  activate: (tier: 'gold' | 'platinum', durationDays: number, proof: PurchaseProof) =>
    api.post('/subscription/activate', { tier, durationDays, ...proof }),

  activateBoost: () => api.post('/subscription/boost'),

  setPassport: (lat: number, lng: number, city?: string, country?: string) =>
    api.post('/subscription/passport', { lat, lng, city, country }),

  clearPassport: () => api.delete('/subscription/passport'),

  setIncognito: (enabled: boolean) =>
    api.post('/subscription/incognito', { enabled }),

  getWhoLikedMe: () => api.get('/users/liked-me'),

  // ── Shop ──────────────────────────────────────────────────────────────
  getShop: () => api.get('/subscription/shop'),

  // ── Super Likes ───────────────────────────────────────────────────────
  purchaseSuperLikes: (packIndex: number, proof: PurchaseProof) =>
    api.post('/subscription/purchase/super-likes', { packIndex, ...proof }),

  // ── Roses ─────────────────────────────────────────────────────────────
  purchaseRoses: (packIndex: number, proof: PurchaseProof) =>
    api.post('/subscription/purchase/roses', { packIndex, ...proof }),

  sendRose: (toUserId: string, message?: string) =>
    api.post('/subscription/roses/send', { toUserId, message }),

  getReceivedRoses: () => api.get('/subscription/roses/received'),

  markRoseSeen: (fromUserId: string) =>
    api.post(`/subscription/roses/seen/${fromUserId}`),

  // ── Boost (purchase extra) ────────────────────────────────────────────
  purchaseBoost: (proof: PurchaseProof) =>
    api.post('/subscription/purchase/boost', { ...proof }),

  // ── Spotlight ─────────────────────────────────────────────────────────
  purchaseSpotlight: (proof: PurchaseProof) =>
    api.post('/subscription/purchase/spotlight', { ...proof }),
};

// ── Moderation API ────────────────────────────────────────────────────
export const moderationApi = {
  submitReport: (
    reportedUserId: string,
    category: string,
    details?: string,
    messageId?: string,
    matchId?: string,
  ) => api.post('/moderation/report', { reportedUserId, category, details, messageId, matchId }),

  markMessageBothered: (messageId: string) =>
    api.post('/moderation/message-bothered', { messageId }),

  getHistory: () => api.get('/moderation/history'),

  exportGDPRData: () => api.get('/moderation/gdpr/export'),
};

// ── Verification API ──────────────────────────────────────────────────
export const verificationApi = {
  getStatus: () => api.get('/verification/status'),

  /** multipart: field `selfie` (jpeg/png/webp, max 10MB) → { status: 'pending' | 'needs_retry' } */
  submitLiveness: (formData: FormData) =>
    api.post('/verification/liveness', formData, MULTIPART),

  /**
   * multipart: fields `document` (image) + `idType` → { status: 'pending' }.
   * The document is stored privately — never upload IDs via /profile/photos.
   */
  submitIDVerification: (formData: FormData) =>
    api.post('/verification/id', formData, MULTIPART),

  createEmergencyShare: (opts: {
    dateVenueName?: string;
    dateVenueAddress?: string;
    matchPersonName?: string;
    durationHours?: number;
  }) => api.post('/verification/emergency-share', opts),

  getActiveEmergencyShare: () => api.get('/verification/emergency-share/active'),

  updateLocation: (lat: number, lng: number, address?: string) =>
    api.post('/verification/emergency-share/location', { lat, lng, address }),

  deactivateShare: () => api.delete('/verification/emergency-share'),
};

// ── Broadcasts API (active banners/announcements) ─────────────────────
export const broadcastApi = {
  getActive: () => api.get('/broadcasts/active'),
};

// ── Notification Preferences API ──────────────────────────────────────
export const notificationApi = {
  getPreferences: () => api.get('/notifications/preferences'),

  updatePreferences: (updates: Record<string, boolean | number>) =>
    api.patch('/notifications/preferences', updates),
};

export default api;
