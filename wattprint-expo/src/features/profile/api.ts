import { apiClient } from '@/lib/session';

import { meSchema, userPreferencesSchema, type UserPreferences } from './schemas';

export const fetchMe = (signal?: AbortSignal) =>
  apiClient.request('/users/me', { schema: meSchema, signal });

export const fetchUserPreferences = (signal?: AbortSignal) =>
  apiClient.request('/users/me/preferences', { schema: userPreferencesSchema, signal });

export const updateUserPreferences = (body: Partial<UserPreferences>) =>
  apiClient.request('/users/me/preferences', {
    schema: userPreferencesSchema,
    method: 'PATCH',
    body,
  });
