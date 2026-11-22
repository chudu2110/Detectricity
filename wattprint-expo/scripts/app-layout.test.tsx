import { render } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import AppLayout from '../src/app/(app)/_layout';

jest.mock('expo-router', () => ({
  Tabs: Object.assign(() => null, { Screen: () => null }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/components/app-tab-bar', () => ({ AppTabBar: () => null }));

it('reads native keyboard visibility on its receiver when the signed-in tabs mount', async () => {
  const visibility = jest.spyOn(Keyboard, 'isVisible');
  try {
    await render(<AppLayout />);
    expect(visibility.mock.contexts).toContain(Keyboard);
  } finally {
    visibility.mockRestore();
  }
});
