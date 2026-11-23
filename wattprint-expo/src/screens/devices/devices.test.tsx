import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { fetchSources } from '@/features/data-sources/api';
import { fetchDevices } from '@/features/dashboard/api';
import { i18n } from '@/i18n';
import { Devices } from '.';

jest.mock('@/features/data-sources/api', () => ({
  fetchSources: jest.fn(),
  discoverPlugs: jest.fn(),
}));
jest.mock('@/features/dashboard/api', () => ({ fetchDevices: jest.fn() }));
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useRouter: () => ({ push: jest.fn() }),
}));

it('clears the search independently and restores all devices from an empty filtered result', async () => {
  await i18n.changeLanguage('en');
  jest.mocked(fetchSources).mockResolvedValue([]);
  jest.mocked(fetchDevices).mockResolvedValue([
    {
      id: 'fridge-1',
      name: 'Fridge',
      room: 'Kitchen',
      type: 'fridge',
      show_on_timeline: true,
      on: false,
      watts: 0,
      today_kwh: 0.4,
      month_kwh: 12,
      week_kwh: [],
    },
  ]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const result = await render(
    <QueryClientProvider client={client}>
      <Devices />
    </QueryClientProvider>,
  );
  try {
    expect(await screen.findByText('Fridge')).toBeOnTheScreen();
    const input = screen.getByLabelText(i18n.t('dashboardNew.searchDevices'));
    await fireEvent.changeText(input, 'missing');
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('dashboardNew.clearSearch') }));
    expect(screen.getByText('Fridge')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: i18n.t('dashboardNew.filterOn') }));
    await fireEvent.changeText(input, 'missing');
    await fireEvent.press(
      screen.getByRole('button', { name: i18n.t('dashboardNew.resetFilters') }),
    );
    expect(input).toHaveProp('value', '');
    expect(
      screen.getByRole('tab', { name: i18n.t('dashboardNew.filterAll'), selected: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Fridge')).toBeOnTheScreen();
  } finally {
    await result.unmount();
    client.clear();
  }
});
