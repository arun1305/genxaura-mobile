import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import {
  usersApi,
  swipeApi,
  getApiErrorMessage,
  getErrorStatus,
  isNetworkError,
} from '../services/api';
import { PAGINATION } from '../constants';

interface Profile {
  _id: string;
  userId: string;
  name: string;
  dob: string;
  gender: string;
  bio: string;
  interests: string[];
  photos: { url: string; storagePath: string; order: number; isMain: boolean }[];
  /** Other users' profiles carry no coordinates — only city/country + `distance`. */
  location?: { city?: string; country?: string };
  /** Distance in km (integer) or null when unknown. */
  distance?: number | null;
}

type SwipeType = 'like' | 'nope' | 'superlike';

export interface SwipeError {
  /** HTTP status, or undefined for network errors */
  status?: number;
  message: string;
  /** 403: daily limit reached → offer an upgrade */
  isLimit: boolean;
}

export interface SwipeResult {
  ok: boolean;
  matched: boolean;
  matchId?: string;
  error?: SwipeError;
}

interface SwipeState {
  profiles: Profile[];
  currentIndex: number;
  isLoading: boolean;
  hasMore: boolean;
  /** Bumped whenever a card is put back so SwipeCards remount centred. */
  deckVersion: number;
  lastMatch: { matchId: string; profile: Profile } | null;

  // Actions
  loadProfiles: () => Promise<void>;
  loadMore: () => Promise<void>;
  swipeLike: (profileUserId: string) => Promise<SwipeResult>;
  swipeNope: (profileUserId: string) => Promise<SwipeResult>;
  swipeSuperLike: (profileUserId: string) => Promise<SwipeResult>;
  undoSwipe: () => Promise<{ ok: boolean; error?: SwipeError }>;
  dismissMatch: () => void;
  reset: () => void;
}

const toSwipeError = (err: unknown): SwipeError => {
  const status = getErrorStatus(err);
  return {
    status,
    message: getApiErrorMessage(err),
    isLimit: status === 403,
  };
};

export const useSwipeStore = create<SwipeState>((set, get) => {
  /** Puts `profile` back on top of the deck (it was at `index` before the swipe). */
  const restoreCard = (profile: Profile) => {
    set((state) => {
      const without = state.profiles.filter((p) => p.userId !== profile.userId);
      // Cards before the current position are already swiped; the restored card
      // becomes the new top card.
      const removedBefore = state.profiles
        .slice(0, state.currentIndex)
        .some((p) => p.userId === profile.userId);
      const newIndex = Math.max(0, removedBefore ? state.currentIndex - 1 : state.currentIndex);
      without.splice(newIndex, 0, profile);
      return { profiles: without, currentIndex: newIndex, deckVersion: state.deckVersion + 1 };
    });
  };

  const doSwipe = async (profileUserId: string, type: SwipeType): Promise<SwipeResult> => {
    const { profiles, currentIndex } = get();
    const profile = profiles[currentIndex];
    set({ currentIndex: currentIndex + 1 });

    // Pre-load more when running low
    if (profiles.length - currentIndex <= 5) {
      get().loadMore();
    }

    try {
      const { data } = await swipeApi.swipe(profileUserId, type);
      const { matched, matchId } = data.data;
      if (matched && matchId && profile) {
        set({ lastMatch: { matchId, profile } });
      }
      return { ok: true, matched: !!matched, matchId };
    } catch (err) {
      const error = toSwipeError(err);
      console.warn(`[SwipeStore] ${type} failed:`, error.status, error.message);
      // 403 (limit reached) or network failure: the swipe did not happen → card stays.
      // 404 (profile unavailable) / 400: the card is dropped.
      if (profile && (error.status === 403 || isNetworkError(err) || (error.status ?? 0) >= 500)) {
        restoreCard(profile);
      }
      return { ok: false, matched: false, error };
    }
  };

  return {
    profiles: [],
    currentIndex: 0,
    isLoading: false,
    hasMore: true,
    deckVersion: 0,
    lastMatch: null,

    loadProfiles: async () => {
      const { isLoading } = get();
      if (isLoading) return;
      set({ isLoading: true });
      try {
        const { data } = await usersApi.discover(1, PAGINATION.PROFILES_PER_PAGE);
        set((state) => ({
          profiles: data.data.profiles,
          hasMore: data.data.hasMore,
          currentIndex: 0,
          deckVersion: state.deckVersion + 1,
        }));
      } catch (err) {
        console.error('[SwipeStore] Load profiles error:', err);
      } finally {
        set({ isLoading: false });
      }
    },

    loadMore: async () => {
      const { isLoading, hasMore } = get();
      if (isLoading || !hasMore) return;
      set({ isLoading: true });
      try {
        // Always page 1: the server excludes users we've already swiped, so
        // offset paging over a shrinking set would skip people.
        const { data } = await usersApi.discover(1, PAGINATION.PROFILES_PER_PAGE);
        const incoming: Profile[] = data.data.profiles || [];
        set((state) => {
          const known = new Set(state.profiles.map((p) => p.userId));
          const fresh = incoming.filter((p) => !known.has(p.userId));
          return {
            profiles: [...state.profiles, ...fresh],
            // Nothing new although the server says there is more → the rest of
            // page 1 is cards still in our deck; allow another try later.
            hasMore: data.data.hasMore || fresh.length > 0,
          };
        });
      } catch (err) {
        console.error('[SwipeStore] Load more error:', err);
      } finally {
        set({ isLoading: false });
      }
    },

    swipeLike: (profileUserId) => doSwipe(profileUserId, 'like'),

    swipeNope: (profileUserId) => doSwipe(profileUserId, 'nope'),

    swipeSuperLike: (profileUserId) => doSwipe(profileUserId, 'superlike'),

    undoSwipe: async () => {
      const { currentIndex } = get();
      if (currentIndex === 0) return { ok: false };
      try {
        const { data } = await swipeApi.undoSwipe();
        if (data.data.restored) {
          set((state) => ({
            currentIndex: Math.max(0, state.currentIndex - 1),
            deckVersion: state.deckVersion + 1,
          }));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          return { ok: true };
        }
        return { ok: false, error: { message: 'There is no swipe to undo.', isLimit: false } };
      } catch (err) {
        const error = toSwipeError(err);
        console.warn('[SwipeStore] Undo error:', error.status, error.message);
        return { ok: false, error };
      }
    },

    dismissMatch: () => set({ lastMatch: null }),

    reset: () =>
      set({
        profiles: [],
        currentIndex: 0,
        isLoading: false,
        hasMore: true,
        deckVersion: 0,
        lastMatch: null,
      }),
  };
});
