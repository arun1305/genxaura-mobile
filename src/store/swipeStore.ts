import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { usersApi, swipeApi } from '../services/api';

interface Profile {
  _id: string;
  userId: string;
  name: string;
  dob: string;
  gender: string;
  bio: string;
  interests: string[];
  photos: { url: string; storagePath: string; order: number; isMain: boolean }[];
  location: { coordinates: [number, number]; city?: string };
  distance?: number;
}

interface SwipeState {
  profiles: Profile[];
  currentIndex: number;
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  lastMatch: { matchId: string; profile: Profile } | null;

  // Actions
  loadProfiles: () => Promise<void>;
  loadMore: () => Promise<void>;
  swipeLike: (profileUserId: string) => Promise<{ matched: boolean; matchId?: string }>;
  swipeNope: (profileUserId: string) => Promise<void>;
  swipeSuperLike: (profileUserId: string) => Promise<{ matched: boolean; matchId?: string }>;
  undoSwipe: () => Promise<void>;
  dismissMatch: () => void;
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set, get) => ({
  profiles: [],
  currentIndex: 0,
  isLoading: false,
  hasMore: true,
  page: 1,
  lastMatch: null,

  loadProfiles: async () => {
    const { isLoading } = get();
    if (isLoading) return;
    set({ isLoading: true });
    try {
      const { data } = await usersApi.discover(1, 20);
      set({
        profiles: data.data.profiles,
        hasMore: data.data.hasMore,
        page: 1,
        currentIndex: 0,
      });
    } catch (err) {
      console.error('[SwipeStore] Load profiles error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { isLoading, hasMore, page } = get();
    if (isLoading || !hasMore) return;
    set({ isLoading: true });
    try {
      const nextPage = page + 1;
      const { data } = await usersApi.discover(nextPage, 20);
      set((state) => ({
        profiles: [...state.profiles, ...data.data.profiles],
        hasMore: data.data.hasMore,
        page: nextPage,
      }));
    } catch (err) {
      console.error('[SwipeStore] Load more error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  swipeLike: async (profileUserId) => {
    const { profiles, currentIndex } = get();
    const profile = profiles[currentIndex];
    set({ currentIndex: currentIndex + 1 });

    // Pre-load more when running low
    if (profiles.length - currentIndex <= 5) {
      get().loadMore();
    }

    try {
      const { data } = await swipeApi.swipe(profileUserId, 'like');
      const { matched, matchId } = data.data;
      if (matched && profile) {
        set({ lastMatch: { matchId, profile } });
      }
      return { matched, matchId };
    } catch (err: any) {
      console.error('[SwipeStore] Like error:', err?.response?.data ?? err?.message);
      return { matched: false };
    }
  },

  swipeNope: async (profileUserId) => {
    const { profiles, currentIndex } = get();
    set({ currentIndex: currentIndex + 1 });

    if (profiles.length - currentIndex <= 5) {
      get().loadMore();
    }

    try {
      await swipeApi.swipe(profileUserId, 'nope');
    } catch (err: any) {
      console.error('[SwipeStore] Nope error:', err?.response?.data ?? err?.message);
    }
  },

  swipeSuperLike: async (profileUserId) => {
    const { profiles, currentIndex } = get();
    const profile = profiles[currentIndex];
    set({ currentIndex: currentIndex + 1 });

    if (profiles.length - currentIndex <= 5) {
      get().loadMore();
    }

    try {
      const { data } = await swipeApi.swipe(profileUserId, 'superlike');
      const { matched, matchId } = data.data;
      if (matched && profile) {
        set({ lastMatch: { matchId, profile } });
      }
      return { matched, matchId };
    } catch (err: any) {
      console.error('[SwipeStore] SuperLike error:', err?.response?.data ?? err?.message);
      return { matched: false };
    }
  },

  undoSwipe: async () => {
    const { currentIndex } = get();
    if (currentIndex === 0) return;
    try {
      const { data } = await swipeApi.undoSwipe();
      if (data.data.restored) {
        set({ currentIndex: currentIndex - 1 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err: any) {
      console.error('[SwipeStore] Undo error:', err?.response?.data ?? err?.message);
    }
  },

  dismissMatch: () => set({ lastMatch: null }),

  reset: () =>
    set({ profiles: [], currentIndex: 0, isLoading: false, hasMore: true, page: 1 }),
}));
