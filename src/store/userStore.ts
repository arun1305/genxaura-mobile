import { create } from 'zustand';
import { profileApi } from '../services/api';

interface Photo {
  url: string;
  storagePath: string;
  order: number;
  isMain: boolean;
}

interface UserProfile {
  _id: string;
  userId: string;
  name: string;
  dob: string;
  gender: string;
  interestedIn: string[];
  bio: string;
  interests: string[];
  photos: Photo[];
  location?: { coordinates: [number, number]; city?: string; country?: string };
  preferences: {
    minAge: number;
    maxAge: number;
    maxDistance: number;
    genderPreference: string[];
  };
  isOnboarded: boolean;
}

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  loadProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateLocation: (lat: number, lng: number, city?: string, country?: string) => Promise<void>;
  uploadPhoto: (formData: FormData) => Promise<{ url: string; storagePath: string }>;
  deletePhoto: (storagePath: string) => Promise<void>;
  reorderPhotos: (order: string[]) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  loadProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await profileApi.getMyProfile();
      set({ profile: data.data });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (updates) => {
    set({ isLoading: true });
    try {
      const { data } = await profileApi.updateProfile(updates);
      set({ profile: data.data });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateLocation: async (lat, lng, city, country) => {
    try {
      await profileApi.updateLocation(lat, lng, city, country);
      set((state) => ({
        profile: state.profile
          ? {
              ...state.profile,
              location: {
                coordinates: [lng, lat],
                city,
                country,
              },
            }
          : null,
      }));
    } catch (err) {
      console.error('[UserStore] Update location error:', err);
    }
  },

  uploadPhoto: async (formData) => {
    const { data } = await profileApi.uploadPhoto(formData);
    await get().loadProfile(); // Refresh to get updated photos array
    return data.data;
  },

  deletePhoto: async (storagePath) => {
    await profileApi.deletePhoto(storagePath);
    set((state) => ({
      profile: state.profile
        ? {
            ...state.profile,
            photos: state.profile.photos.filter((p) => p.storagePath !== storagePath),
          }
        : null,
    }));
  },

  reorderPhotos: async (order) => {
    const { data } = await profileApi.reorderPhotos(order);
    set({ profile: data.data });
  },

  completeOnboarding: async () => {
    await profileApi.completeOnboarding();
    set((state) => ({
      profile: state.profile ? { ...state.profile, isOnboarded: true } : null,
    }));
  },

  setProfile: (profile) => set({ profile }),
}));
