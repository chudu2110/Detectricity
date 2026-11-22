import { z } from 'zod';

export const envSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  EXPO_PUBLIC_DEMO_MODE: z.enum(['0', '1']).default('0'),
  EXPO_PUBLIC_API_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  EXPO_PUBLIC_KEYCLOAK_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((i) => String(i.path[0])))].join(', ');
    throw new Error(`Invalid environment: ${keys}`);
  }
  return result.data;
}

// Static dot access is required: Metro inlines EXPO_PUBLIC_* only for literal `process.env.NAME`.
export const env: Env = parseEnv({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_KEYCLOAK_URL: process.env.EXPO_PUBLIC_KEYCLOAK_URL,
});

export function isLocalDemo(): boolean {
  return __DEV__ && env.EXPO_PUBLIC_APP_ENV === 'development' && env.EXPO_PUBLIC_DEMO_MODE === '1';
}
