import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// ── Axios Instance ────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – attach JWT
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor – auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = data.data.tokens;

        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', newRefresh);

        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        // Trigger logout via event or navigation
      }
    }
    return Promise.reject(error);
  },
);

// ── Auth API ──────────────────────────────────────────────────────────
export const authApi = {
  loginWithPhone: (phone: string, idToken: string) =>
    api.post('/auth/phone', { phone, idToken }),

  loginWithGoogle: (idToken: string) =>
    api.post('/auth/google', { idToken }),

  loginWithApple: (idToken: string, fullName?: string, email?: string) =>
    api.post('/auth/apple', { idToken, fullName, email }),

  loginWithEmail: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  logout: () => api.post('/auth/logout'),

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

  uploadPhoto: (formData: FormData) =>
    api.post('/profile/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),

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
    api.post(`/messages/${matchId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteMessage: (messageId: string) => api.delete(`/messages/${messageId}`),
};

// ── Subscription API ──────────────────────────────────────────────────
export const subscriptionApi = {
  getStatus: () => api.get('/subscription/status'),

  activate: (tier: 'gold' | 'platinum', durationDays: number, transactionId?: string) =>
    api.post('/subscription/activate', { tier, durationDays, transactionId }),

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
  purchaseSuperLikes: (packIndex: number, transactionId?: string) =>
    api.post('/subscription/purchase/super-likes', { packIndex, transactionId }),

  // ── Roses ─────────────────────────────────────────────────────────────
  purchaseRoses: (packIndex: number, transactionId?: string) =>
    api.post('/subscription/purchase/roses', { packIndex, transactionId }),

  sendRose: (toUserId: string, message?: string) =>
    api.post('/subscription/roses/send', { toUserId, message }),

  getReceivedRoses: () => api.get('/subscription/roses/received'),

  markRoseSeen: (fromUserId: string) =>
    api.post(`/subscription/roses/seen/${fromUserId}`),

  // ── Boost (purchase extra) ────────────────────────────────────────────
  purchaseBoost: (transactionId?: string) =>
    api.post('/subscription/purchase/boost', { transactionId }),

  // ── Spotlight ─────────────────────────────────────────────────────────
  purchaseSpotlight: (transactionId?: string) =>
    api.post('/subscription/purchase/spotlight', { transactionId }),
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

  submitLiveness: (selfieUrl: string) =>
    api.post('/verification/liveness', { selfieUrl }),

  submitIDVerification: (idDocumentUrl: string, idType: string) =>
    api.post('/verification/id', { idDocumentUrl, idType }),

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
