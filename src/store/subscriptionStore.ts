import { create } from 'zustand';
import { subscriptionApi } from '../services/api';

export type SubscriptionTier = 'free' | 'gold' | 'platinum';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  expiresAt?: string;
  limits: {
    dailyLikes: number;
    dailySuperLikes: number;
    dailyUndos: number;
    monthlyBoosts: number;
    unlimitedLikes: boolean;
    unlimitedSuperLikes: boolean;
    unlimitedUndos: boolean;
    seeWhoLikedYou: boolean;
    passport: boolean;
    incognito: boolean;
    priorityLikes: boolean;
    advancedFilters: boolean;
    messageBeforeMatch: boolean;
    noAds: boolean;
  };
  usage: {
    dailyLikesUsed: number;
    dailySuperLikesUsed: number;
    dailyUndosUsed: number;
    monthlyBoostsUsed: number;
  };
  remaining: {
    likes: number | null;
    superLikes: number | null;
    undos: number | null;
    boosts: number;
  };
  isBoostActive: boolean;
  boostExpiresAt?: string;
  passportLocation?: { lat: number; lng: number; city?: string; country?: string } | null;
  incognitoMode: boolean;
  superLikesBalance: number;
  rosesBalance: number;
  isSpotlightActive: boolean;
  spotlightExpiresAt?: string;
}

export interface ReceivedRose {
  _id: string;
  fromUser: string;
  toUser: string;
  seen: boolean;
  message?: string;
  createdAt?: string;
}

interface LikedMeProfile {
  _id: string;
  userId: string;
  name: string;
  photos?: { url: string }[];
  dob?: string;
}

interface SubscriptionState {
  status: SubscriptionStatus | null;
  likedMe: LikedMeProfile[];
  receivedRoses: ReceivedRose[];
  isLoading: boolean;

  loadStatus: () => Promise<void>;
  loadWhoLikedMe: () => Promise<void>;
  activateBoost: () => Promise<void>;
  setPassport: (lat: number, lng: number, city?: string, country?: string) => Promise<void>;
  clearPassport: () => Promise<void>;
  setIncognito: (enabled: boolean) => Promise<void>;

  // À-la-carte purchases
  purchaseSuperLikes: (packIndex: number, transactionId?: string) => Promise<{ newBalance: number }>;
  purchaseRoses: (packIndex: number, transactionId?: string) => Promise<{ newBalance: number }>;
  purchaseBoost: (transactionId?: string) => Promise<void>;
  purchaseSpotlight: (transactionId?: string) => Promise<void>;
  sendRose: (toUserId: string, message?: string) => Promise<void>;
  loadReceivedRoses: () => Promise<void>;
  markRoseSeen: (fromUserId: string) => Promise<void>;

  // Helpers
  isGoldOrAbove: () => boolean;
  isPlatinum: () => boolean;
  canLike: () => boolean;
  canSuperLike: () => boolean;
  canUndo: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  status: null,
  likedMe: [],
  receivedRoses: [],
  isLoading: false,

  loadStatus: async () => {
    set({ isLoading: true });
    try {
      const { data } = await subscriptionApi.getStatus();
      set({ status: data.data });
    } catch (err) {
      console.error('[SubscriptionStore] Load error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  loadWhoLikedMe: async () => {
    try {
      const { data } = await subscriptionApi.getWhoLikedMe();
      set({ likedMe: data.data || [] });
    } catch (err) {
      console.error('[SubscriptionStore] Who liked me error:', err);
    }
  },

  activateBoost: async () => {
    const { data } = await subscriptionApi.activateBoost();
    set((state) => ({
      status: state.status
        ? { ...state.status, isBoostActive: true, boostExpiresAt: data.data.expiresAt }
        : state.status,
    }));
  },

  setPassport: async (lat, lng, city, country) => {
    await subscriptionApi.setPassport(lat, lng, city, country);
    set((state) => ({
      status: state.status
        ? { ...state.status, passportLocation: { lat, lng, city, country } }
        : state.status,
    }));
  },

  clearPassport: async () => {
    await subscriptionApi.clearPassport();
    set((state) => ({
      status: state.status ? { ...state.status, passportLocation: null } : state.status,
    }));
  },

  setIncognito: async (enabled) => {
    await subscriptionApi.setIncognito(enabled);
    set((state) => ({
      status: state.status ? { ...state.status, incognitoMode: enabled } : state.status,
    }));
  },

  purchaseSuperLikes: async (packIndex, transactionId) => {
    const { data } = await subscriptionApi.purchaseSuperLikes(packIndex, transactionId);
    const newBalance = data.data.newBalance as number;
    set((state) => ({
      status: state.status ? { ...state.status, superLikesBalance: newBalance } : state.status,
    }));
    return { newBalance };
  },

  purchaseRoses: async (packIndex, transactionId) => {
    const { data } = await subscriptionApi.purchaseRoses(packIndex, transactionId);
    const newBalance = data.data.newBalance as number;
    set((state) => ({
      status: state.status ? { ...state.status, rosesBalance: newBalance } : state.status,
    }));
    return { newBalance };
  },

  purchaseBoost: async (transactionId) => {
    const { data } = await subscriptionApi.purchaseBoost(transactionId);
    set((state) => ({
      status: state.status
        ? { ...state.status, isBoostActive: true, boostExpiresAt: data.data.expiresAt }
        : state.status,
    }));
  },

  purchaseSpotlight: async (transactionId) => {
    const { data } = await subscriptionApi.purchaseSpotlight(transactionId);
    set((state) => ({
      status: state.status
        ? { ...state.status, isSpotlightActive: true, spotlightExpiresAt: data.data.expiresAt }
        : state.status,
    }));
  },

  sendRose: async (toUserId, message) => {
    await subscriptionApi.sendRose(toUserId, message);
    set((state) => ({
      status: state.status
        ? { ...state.status, rosesBalance: Math.max(0, (state.status.rosesBalance || 0) - 1) }
        : state.status,
    }));
  },

  loadReceivedRoses: async () => {
    try {
      const { data } = await subscriptionApi.getReceivedRoses();
      set({ receivedRoses: data.data || [] });
    } catch (err) {
      console.error('[SubscriptionStore] Load roses error:', err);
    }
  },

  markRoseSeen: async (fromUserId) => {
    await subscriptionApi.markRoseSeen(fromUserId);
    set((state) => ({
      receivedRoses: state.receivedRoses.map((r) =>
        r.fromUser === fromUserId ? { ...r, seen: true } : r,
      ),
    }));
  },

  isGoldOrAbove: () => {
    const tier = get().status?.tier;
    return tier === 'gold' || tier === 'platinum';
  },

  isPlatinum: () => get().status?.tier === 'platinum',

  canLike: () => {
    const s = get().status;
    if (!s) return true;
    if (s.limits.unlimitedLikes) return true;
    return (s.remaining.likes ?? 0) > 0;
  },

  canSuperLike: () => {
    const s = get().status;
    if (!s) return true;
    if (s.limits.unlimitedSuperLikes) return true;
    if ((s.remaining.superLikes ?? 0) > 0) return true;
    return (s.superLikesBalance || 0) > 0;
  },

  canUndo: () => {
    const s = get().status;
    if (!s) return true;
    if (s.limits.unlimitedUndos) return true;
    return (s.remaining.undos ?? 0) > 0;
  },
}));
