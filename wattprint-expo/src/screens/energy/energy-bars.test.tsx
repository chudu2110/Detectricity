import { fireEvent, render, screen } from '@testing-library/react-native';
import { i18n } from '@/i18n';
import { EnergyBars } from '@/screens/dashboard-parts';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

it('inspects the selected interval, keeping zero and missing readings distinct', async () => {
  await i18n.changeLanguage('en');
  await render(
    <EnergyBars
      buckets={[0, undefined, 1.5]}
      labels={['00:00', '03:00']}
      intervalLabel={(index) => `Hour ${index + 1}`}
      summary="Hourly energy"
    />,
  );
  const chart = screen.getByRole('adjustable', { name: 'Hourly energy' });
  expect(chart.props.accessibilityValue.text).toBe('Hour 3, 1.5 kWh');
  await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 300 } } });
  await fireEvent.press(chart, { nativeEvent: { locationX: 2 } });
  expect(chart.props.accessibilityValue.text).toBe('Hour 1, 0 kWh');
  await fireEvent(chart, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(chart.props.accessibilityValue.text).toBe('Hour 2, No reading');
  await fireEvent.press(chart, { nativeEvent: { locationX: 300 } });
  expect(chart.props.accessibilityValue.text).toBe('Hour 3, 1.5 kWh');
});
