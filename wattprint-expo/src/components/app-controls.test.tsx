import { fireEvent, render, screen } from '@testing-library/react-native';

import { ActionButton, SegmentedControl } from './app-ui';

// Jest doesn't load Metro's theme sheet. Keep these interaction tests independent of SVG paint.
jest.mock('uniwind', () => ({
  ...jest.requireActual('uniwind'),
  useCSSVariable: () => 'transparent',
}));

it('keeps a busy action labelled and blocks a repeated press until it finishes', async () => {
  const onPress = jest.fn();
  const button = (busy: boolean) => (
    <ActionButton busy={busy} trailingIcon="arrow" onPress={onPress}>
      Lưu thay đổi
    </ActionButton>
  );
  const view = await render(button(true));
  const pending = screen.getByRole('button', { name: 'Lưu thay đổi', busy: true });
  expect(pending).toBeDisabled();
  await fireEvent.press(pending);
  expect(onPress).not.toHaveBeenCalled();

  await view.rerender(button(false));
  await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi', busy: false }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('exposes the chosen segment to assistive technology after selection changes', async () => {
  const options = [
    { label: 'Ngày', value: 'day' },
    { label: 'Tháng', value: 'month' },
  ];
  const onChange = jest.fn();
  const selector = (value: string) => (
    <SegmentedControl value={value} options={options} onChange={onChange} />
  );
  const view = await render(selector('day'));
  await fireEvent.press(screen.getByRole('tab', { name: 'Tháng', selected: false }));
  expect(onChange).toHaveBeenCalledWith('month');
  await view.rerender(selector('month'));
  expect(screen.getByRole('tab', { name: 'Tháng', selected: true })).toBeOnTheScreen();
});
