import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import '@/i18n';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { fetchDevices, fetchOverview, fetchSeries, fetchWeather } from '@/features/dashboard/api';
import { NetworkError } from '@/lib/errors';
import { env } from '@/env';
import { useAuthStore } from '@/stores/auth-store';

import { LiveDashboard } from './live-dashboard';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/features/dashboard/api', () => ({
  fetchDevices: jest.fn(),
  fetchOverview: jest.fn(),
  fetchSeries: jest.fn(),
  fetchWeather: jest.fn(),
}));
jest.mock('@/features/energy/hooks/use-chart-bar-color', () => ({
  useChartBarColor: () => 'rgb(23, 23, 23)',
}));

const clients: QueryClient[] = [];
async function show(section: 'home' | 'devices' | 'energy') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  await render(
    <GluestackUIProvider>
      <QueryClientProvider client={client}>
        <LiveDashboard section={section} />
      </QueryClientProvider>
    </GluestackUIProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchDevices).mockResolvedValue([]);
  jest.mocked(fetchOverview).mockResolvedValue({ live: null, today: null });
  jest.mocked(fetchWeather).mockResolvedValue({
    province: 'Ho Chi Minh',
    now: { temp: 29, humidity: 72, sky: { description: 'Clouds' } },
  });
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  env.EXPO_PUBLIC_DEMO_MODE = '0';
  useAuthStore.getState().setSignedOut();
});

it('labels the demo account so replay data is not mistaken for the personal home', async () => {
  env.EXPO_PUBLIC_DEMO_MODE = '1';
  useAuthStore.getState().setSignedIn({
    id: 'demo',
    email: 'demo@example.com',
    full_name: 'REFIT House 2',
    is_active: true,
    roles: ['user'],
  });
  await show('home');
  expect(await screen.findByText('Demo account: REFIT House 2')).toBeTruthy();
});

it('renders meter and weather values returned by the API', async () => {
  jest.mocked(fetchOverview).mockResolvedValue({
    live: { ts: '2026-11-21T08:00:00Z', watts: 421 },
    today: { kwh: 6.2, typical_kwh: null },
  });
  await show('home');
  expect(await screen.findByText('421 W')).toBeTruthy();
  expect(await screen.findByText('6.2 kWh')).toBeTruthy();
  expect(await screen.findByText('29 °C · Clouds')).toBeTruthy();
  expect(screen.queryByText('14.3 kWh')).toBeNull();
});

it('converts watt-hours from the backend to kWh in the chart', async () => {
  jest.mocked(fetchSeries).mockResolvedValue([
    { ts: '2026-11-21T08:00:00Z', energy_wh: 1200 },
    { ts: '2026-11-21T09:00:00Z', energy_wh: 300 },
  ]);
  await show('energy');
  expect(await screen.findByText('Last 24 hours: 1.5 kWh')).toBeTruthy();
  expect(screen.getByTestId('cartesian-chart').props.data).toEqual([
    { x: 0, kwh: 1.2 },
    { x: 1, kwh: 0.3 },
  ]);
  expect(fetchOverview).not.toHaveBeenCalled();
});

it('shows API errors instead of replacing them with mock devices', async () => {
  jest.mocked(fetchDevices).mockRejectedValue(new NetworkError('Offline'));
  await show('devices');
  expect(await screen.findByText('Try again')).toBeTruthy();
  expect(screen.queryByText('Lamp')).toBeNull();
});

it('shows real devices without pretending to control inferred appliances', async () => {
  jest.mocked(fetchDevices).mockResolvedValue([
    {
      id: 'meter-device',
      name: 'Kettle',
      room: null,
      type: 'kettle',
      show_on_timeline: true,
      on: true,
      watts: 800,
      today_kwh: 0.4,
      month_kwh: 3.2,
      week_kwh: [],
    },
  ]);
  await show('devices');
  expect(await screen.findByText('Kettle')).toBeTruthy();
  expect(screen.getByText('800 W')).toBeTruthy();
  expect(screen.queryAllByRole('switch')).toHaveLength(0);
});
