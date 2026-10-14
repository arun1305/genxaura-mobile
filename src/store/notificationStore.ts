import { create } from 'zustand';
import { notificationApi } from '../services/api';

export interface NotificationPreferences {
  newMatch: boolean;
  newMessage: boolean;
  superLikeReceived: boolean;
  likedYou: boolean;
  boostActive: boolean;
  dailyRecap: boolean;
  reEngagement: boolean;
  muteAll: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
}

interface NotificationState {
  prefs: NotificationPreferences | null;
  isLoading: boolean;
  loadPreferences: () => Promise<void>;
  updatePreference: (key: keyof NotificationPreferences, value: boolean | number) => Promise<void>;
  reset: () => void;
}

const DEFAULT_PREFS: NotificationPreferences = {
  newMatch: true,
  newMessage: true,
  superLikeReceived: true,
  likedYou: true,
  boostActive: true,
  dailyRecap: false,
  reEngagement: true,
  muteAll: false,
  quietHoursEnabled: false,
  quietHoursStart: 22,
  quietHoursEnd: 8,
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  prefs: null,
  isLoading: false,

  loadPreferences: async () => {
    set({ isLoading: true });
    try {
      const { data } = await notificationApi.getPreferences();
      set({ prefs: { ...DEFAULT_PREFS, ...data.data } });
    } catch {
      set({ prefs: DEFAULT_PREFS });
    } finally {
      set({ isLoading: false });
    }
  },

  updatePreference: async (key, value) => {
    // Optimistic update — apply the new value immediately
    const previousPrefs = get().prefs;
    set((state) => ({
      prefs: state.prefs ? { ...state.prefs, [key]: value } : state.prefs,
    }));
    try {
      await notificationApi.updatePreferences({ [key]: value });
    } catch (err) {
      // Revert to previous state on failure
      if (previousPrefs) {
        set({ prefs: { ...previousPrefs } });
      }
      throw err;
    }
  },

  reset: () => set({ prefs: null, isLoading: false }),
}));
