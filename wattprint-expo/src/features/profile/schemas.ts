import { z } from 'zod';

import { userSchema } from '@/lib/auth-service';

export const meSchema = userSchema;
export type Me = z.output<typeof meSchema>;

export const userPreferencesSchema = z.object({
  notify_anomaly: z.boolean(),
  notify_tier: z.boolean(),
  weekly_summary: z.boolean(),
});

export type UserPreferences = z.output<typeof userPreferencesSchema>;
