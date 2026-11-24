import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { acceptPlan } from '@/features/copilot/api';
import { fetchGoal, fetchPlans, saveGoal } from '@/features/dashboard/api';
import type { Goal, Plan } from '@/features/dashboard/schemas';
import { i18n } from '@/i18n';
import { parseAmount } from '@/screens/dashboard-parts';

import { GoalSection } from './goal-section';
import { PlansSection } from './plans-section';

jest.mock('@/features/dashboard/api', () => ({
  fetchGoal: jest.fn(),
  saveGoal: jest.fn(),
  deleteGoal: jest.fn(),
  fetchPlans: jest.fn(),
}));
jest.mock('@/features/copilot/api', () => ({ acceptPlan: jest.fn() }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));

const OVER: Goal = {
  kind: 'kwh',
  target: 350,
  period_start: '2026-11-01',
  period_end: '2026-11-30',
  used: 285,
  projected: 368.2,
  status: 'over',
  excess: 18.2,
  cut_kwh: 18.2,
  days_left: 6,
  left_per_day: 10.83,
  devices: [{ id: 'd1', name: 'Dishwasher', kwh: 25.5, share: 0.3 }],
};

async function show(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const result = await render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  );
  return async () => {
    await result.unmount();
    client.clear();
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

it('reads amounts written the Vietnamese or the English way', () => {
  expect(parseAmount('750.000')).toBe(750000);
  expect(parseAmount('1.234,5')).toBe(1234.5);
  expect(parseAmount('350')).toBe(350);
  expect(parseAmount('12,5')).toBe(12.5);
  expect(parseAmount('abc')).toBeNaN();
});

it('shows an over goal with what to cut and where to start', async () => {
  jest.mocked(fetchGoal).mockResolvedValue(OVER);
  const done = await show(<GoalSection />);
  try {
    expect(await screen.findByText(i18n.t('savings.status.over'))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('savings.cut', { value: '18.2 kWh' }))).toBeOnTheScreen();
    expect(screen.getByText('Dishwasher')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ now: 81 });
  } finally {
    await done();
  }
});

it('sets a goal from an empty state and refuses a non-positive amount', async () => {
  jest.mocked(fetchGoal).mockResolvedValue(null);
  jest.mocked(saveGoal).mockResolvedValue({ ...OVER, kind: 'vnd', target: 750000 });
  const done = await show(<GoalSection />);
  try {
    await fireEvent.press(await screen.findByRole('button', { name: i18n.t('savings.setGoal') }));
    await fireEvent.press(screen.getByRole('tab', { name: i18n.t('savings.unitVnd') }));
    const input = screen.getByLabelText(i18n.t('savings.targetLabel', { unit: 'đ' }));
    await fireEvent.changeText(input, '0');
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('savings.save') }));
    expect(screen.getByText(i18n.t('savings.invalidTarget'))).toBeOnTheScreen();
    expect(saveGoal).not.toHaveBeenCalled();
    await fireEvent.changeText(input, '750.000');
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('savings.save') }));
    expect(jest.mocked(saveGoal).mock.calls[0][0]).toEqual({ kind: 'vnd', target: 750000 });
    expect(
      await screen.findByRole('button', { name: i18n.t('savings.editGoal') }),
    ).toBeOnTheScreen();
  } finally {
    await done();
  }
});

it('lists plans with their measured saving, margin and a start button', async () => {
  const plans: Plan[] = [
    {
      id: 'p1',
      title: 'Cut standby',
      status: 'accepted',
      started_at: '2026-11-01T05:00:00Z',
      tasks: ['Unplug chargers'],
      expected_kwh_per_month: 12,
      expected_vnd_per_month: null,
      measure: {
        status: 'measured',
        trial_day: 14,
        trial_days: 14,
        days_with_data_before: 14,
        days_with_data_after: 14,
        kwh_per_month_saved: 9.5,
        kwh_per_month_margin: 12,
        clear: false,
      },
    },
    {
      id: 'p2',
      title: 'Wash cold',
      status: 'proposed',
      started_at: null,
      tasks: [],
      expected_kwh_per_month: 0,
      expected_vnd_per_month: null,
      measure: null,
    },
  ];
  jest.mocked(fetchPlans).mockResolvedValue(plans);
  jest.mocked(acceptPlan).mockResolvedValue({ id: 'p2', status: 'accepted' });
  const done = await show(<PlansSection />);
  try {
    expect(
      await screen.findByText(i18n.t('savings.measured', { value: '9.5 kWh', margin: '12 kWh' })),
    ).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('savings.unclear'))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('savings.notMeasurable'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('savings.start') }));
    expect(acceptPlan).toHaveBeenCalledWith('p2');
  } finally {
    await done();
  }
});
