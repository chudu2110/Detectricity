import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useSystemReducedMotion } from './use-system-reduced-motion';

afterEach(() => jest.restoreAllMocks());

it('keeps the latest motion change when the initial native snapshot resolves late', async () => {
  let resolveSnapshot!: (value: boolean) => void;
  const snapshot = new Promise<boolean>((resolve) => {
    resolveSnapshot = resolve;
  });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(snapshot);
  const subscription = jest.spyOn(AccessibilityInfo, 'addEventListener');
  const { result } = await renderHook(useSystemReducedMotion);
  const listener = subscription.mock.calls.find(([name]) => name === 'reduceMotionChanged')?.[1];
  expect(listener).toBeDefined();
  await act(() => listener?.(true));
  await act(async () => {
    resolveSnapshot(false);
    await snapshot;
  });
  expect(result.current).toBe(true);
  await act(() => listener?.(false));
  expect(result.current).toBe(false);
});
