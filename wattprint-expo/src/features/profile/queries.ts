import { queryOptions } from '@tanstack/react-query';

import { fetchMe, fetchUserPreferences } from '@/features/profile/api';

export const profileKeys = {
  me: ['profile', 'me'] as const,
  preferences: ['profile', 'preferences'] as const,
};

// staleTime 0: opening the screen always asks FastAPI, which is the point of this check.
export const meQuery = () =>
  queryOptions({
    queryKey: profileKeys.me,
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 0,
  });

export const userPreferencesQuery = () =>
  queryOptions({
    queryKey: profileKeys.preferences,
    queryFn: ({ signal }) => fetchUserPreferences(signal),
  });
