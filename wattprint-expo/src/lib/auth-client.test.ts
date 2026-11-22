import * as SecureStore from 'expo-secure-store';

import { env } from '@/env';
import { fetchApiToken, REFRESH_TOKEN_KEY, secureStorage } from './auth-client';

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn(),
  makeRedirectUri: () => 'wattprint://auth',
  Prompt: { Login: 'login' },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const getItem = SecureStore.getItemAsync as jest.Mock;
const setItem = SecureStore.setItemAsync as jest.Mock;
const deleteItem = SecureStore.deleteItemAsync as jest.Mock;

describe('auth client', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses one SecureStore key under the wattprint prefix', () => {
    expect(REFRESH_TOKEN_KEY).toBe('wattprint.refresh-token');
    // SecureStore only accepts letters, digits, ".", "-" and "_" in keys.
    expect(REFRESH_TOKEN_KEY).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('backs the storage with SecureStore', async () => {
    getItem.mockResolvedValue('r1');
    await expect(secureStorage.get('k')).resolves.toBe('r1');
    await secureStorage.set('k', 'v');
    await secureStorage.remove('k');
    expect(getItem).toHaveBeenCalledWith('k');
    expect(setItem).toHaveBeenCalledWith('k', 'v');
    expect(deleteItem).toHaveBeenCalledWith('k');
  });

  it('refreshes the normal session, returning null when none was stored', async () => {
    getItem.mockResolvedValue(null);
    await expect(fetchApiToken()).resolves.toBeNull();
    expect(getItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
  });

  it('renews the demo session through the API without reading Google credentials', async () => {
    env.EXPO_PUBLIC_DEMO_MODE = '1';
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          accessToken: 'demo-access',
          user: {
            id: 'demo',
            email: 'demo@example.com',
            full_name: 'Demo',
            is_active: true,
            roles: ['user'],
          },
        }),
    } as Response);
    try {
      await expect(fetchApiToken()).resolves.toBe('demo-access');
      expect(String(request.mock.calls[0][0])).toMatch(/\/auth\/demo$/);
      expect(getItem).not.toHaveBeenCalled();
    } finally {
      env.EXPO_PUBLIC_DEMO_MODE = '0';
      request.mockRestore();
    }
  });
});
