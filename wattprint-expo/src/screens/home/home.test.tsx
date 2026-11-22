import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { Home } from '.';
import { i18n } from '@/i18n';
import {
  fetchDevices,
  fetchOverview,
  fetchHome,
  fetchBill,
  fetchWeather,
} from '@/features/dashboard/api';
import { NetworkError } from '@/lib/errors';
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }),
}));
jest.mock('@/features/dashboard/api', () => ({
  fetchDevices: jest.fn(),
  fetchOverview: jest.fn(),
  fetchHome: jest.fn(),
  fetchBill: jest.fn(),
  fetchWeather: jest.fn(),
}));
const clients: QueryClient[] = [];
beforeEach(async () => {
  await i18n.changeLanguage('en');
  jest.clearAllMocks();
  jest.mocked(fetchHome).mockResolvedValue({
    id: 'home',
    name: 'My home',
    role: 'owner',
    home_type: null,
    floor_area_m2: null,
    occupants: null,
    billing_cycle_day: 1,
    province_code: null,
  });
  jest.mocked(fetchDevices).mockResolvedValue([]);
  jest.mocked(fetchOverview).mockResolvedValue({
    live: { ts: '2026-11-21T08:00:00Z', watts: 421 },
    today: { kwh: 6.2, typical_kwh: null },
  });
  jest.mocked(fetchWeather).mockResolvedValue({
    province: 'Ho Chi Minh',
    now: { temp: 29, humidity: 72, sky: { description: 'Clouds' } },
  });
  jest.mocked(fetchBill).mockRejectedValue(new NetworkError('offline'));
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
async function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}
it('renders real household readings and offers the assistant without fake appliance controls', async () => {
  await show();
  expect(await screen.findByText('421 W')).toBeTruthy();
  expect(await screen.findByText('6.2 kWh')).toBeTruthy();
  expect(screen.getByText('Ask the assistant')).toBeTruthy();
  expect(screen.queryAllByRole('switch')).toHaveLength(0);
});
it('shows an unavailable meter instead of substituting sample consumption', async () => {
  jest.mocked(fetchOverview).mockRejectedValue(new NetworkError('offline'));
  await show();
  expect(await screen.findByText('Try again')).toBeTruthy();
  expect(screen.queryByText('6.2 kWh')).toBeNull();
});
