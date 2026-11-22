import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

type PreferencesState = {
  theme: ThemePreference;
  language: 'vi' | 'en';
  setLanguage: (language: 'vi' | 'en') => void;
  setTheme: (theme: ThemePreference) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'vi',
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
      migrate: (state) => ({
        theme: 'system',
        ...(state as Partial<PreferencesState>),
        language: 'vi',
      }),
    },
  ),
);
