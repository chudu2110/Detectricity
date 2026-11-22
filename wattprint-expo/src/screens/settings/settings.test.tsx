import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  acknowledgeAlert,
  fetchAlerts,
  fetchHome,
  fetchProvinces,
  updateHome,
} from '@/features/dashboard/api';
import type { Alert, Home } from '@/features/dashboard/schemas';
import { fetchMe, fetchUserPreferences, updateUserPreferences } from '@/features/profile/api';
import { i18n } from '@/i18n';

import { Settings } from '.';
import { Alerts } from './alerts';
import { HomeSettings } from './home-settings';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/dashboard/api', () => ({
  fetchHome: jest.fn(),
  fetchProvinces: jest.fn(),
  fetchAlerts: jest.fn(),
  updateHome: jest.fn(),
  acknowledgeAlert: jest.fn(),
}));
jest.mock('@/features/profile/api', () => ({
  fetchMe: jest.fn(),
  fetchUserPreferences: jest.fn(),
  updateUserPreferences: jest.fn(),
}));

const mockSignOut = jest.fn();
jest.mock('@/features/auth/hooks/use-sign-out', () => ({
  useSignOut: () => ({ mutate: mockSignOut, isPending: false }),
}));

const home: Home = {
  id: 'home',
  name: 'Test household',
  home_type: 'apartment',
  floor_area_m2: null,
  occupants: 3,
  billing_cycle_day: 14,
  province_code: null,
  role: 'owner',
};

const emailPreferences = { notify_anomaly: true, notify_tier: true, weekly_summary: false };

const tierAlert: Alert = {
  id: 'tier-alert',
  kind: 'tier_near',
  severity: 'info',
  status: 'open',
  ts: '2026-11-21T09:00:00+07:00',
  resolved_at: null,
  device: null,
  payload: { tier_no: 2, from_kwh: 50, price_per_kwh: 1893, days: 0 },
};

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
async function renderPage(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  await render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
  jest.mocked(fetchMe).mockResolvedValue({
    id: 'user',
    email: 'resident@example.test',
    full_name: 'Household Resident',
    is_active: true,
    roles: [],
  });
  jest.mocked(fetchHome).mockResolvedValue(home);
  jest.mocked(fetchProvinces).mockResolvedValue([]);
  jest.mocked(fetchUserPreferences).mockResolvedValue(emailPreferences);
  jest
    .mocked(updateUserPreferences)
    .mockResolvedValue({ ...emailPreferences, weekly_summary: true });
  jest.mocked(fetchAlerts).mockResolvedValue([tierAlert]);
  jest.mocked(acknowledgeAlert).mockResolvedValue(undefined);
});

it('shows the signed-in profile and saves email preferences before signing out', async () => {
  await renderPage(<Settings />);
  expect(await screen.findByText('resident@example.test')).toBeOnTheScreen();
  expect(await screen.findByText('Test household')).toBeOnTheScreen();
  const label = i18n.t('account.weekly_summary');
  await fireEvent(await screen.findByLabelText(label), 'valueChange', true);
  await waitFor(() =>
    expect(updateUserPreferences).toHaveBeenCalledWith(
      { weekly_summary: true },
      expect.any(Object),
    ),
  );
  await waitFor(() => expect(screen.getByLabelText(label)).toHaveProp('value', true));
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('account.signOut') }));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('shows members the household without edit access', async () => {
  jest.mocked(fetchHome).mockResolvedValueOnce({ ...home, role: 'member' });
  await renderPage(<HomeSettings />);
  expect(await screen.findByText(home.name)).toBeOnTheScreen();
  expect(screen.getByText(i18n.t('account.readOnly'))).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: i18n.t('account.edit') })).toBeNull();
});

it('validates edits and saves only the fields the owner changed', async () => {
  jest.mocked(updateHome).mockResolvedValue({ ...home, floor_area_m2: '56.70' });
  await renderPage(<HomeSettings />);
  await fireEvent.press(await screen.findByRole('button', { name: i18n.t('account.edit') }));
  await fireEvent.changeText(screen.getByLabelText(i18n.t('account.floorArea')), '0');
  const save = screen.getByRole('button', { name: i18n.t('account.save') });
  await fireEvent.press(save);
  expect(screen.getByText(i18n.t('account.invalidArea'))).toBeOnTheScreen();
  expect(updateHome).toHaveBeenCalledTimes(0);
  await fireEvent.changeText(screen.getByLabelText(i18n.t('account.floorArea')), '56,70');
  await fireEvent.press(save);
  await waitFor(() =>
    expect(updateHome).toHaveBeenCalledWith({ floor_area_m2: '56.70' }, expect.any(Object)),
  );
  expect(await screen.findByText(i18n.t('account.saved'))).toBeOnTheScreen();
});

it('marks a reached tariff alert as seen after the server update', async () => {
  await renderPage(<Alerts />);
  expect(
    await screen.findByText(i18n.t('notifications.tier.reached', { tier: '2' })),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('notifications.acknowledge') }));
  expect(await screen.findByText(i18n.t('notifications.acknowledged'))).toBeOnTheScreen();
  expect(acknowledgeAlert).toHaveBeenCalledWith('tier-alert', expect.any(Object));
});
