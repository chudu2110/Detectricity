import { deviceEnergy } from './period';
import { alertSchema, deviceDetailSchema, overviewSchema, seriesSchema } from './schemas';

it('accepts nullable readings and backend timestamps with UTC offsets', () => {
  expect(overviewSchema.parse({ live: null, today: null }).live).toBeNull();
  expect(seriesSchema.parse([{ ts: '2026-11-21T09:00:00+00:00', energy_wh: 1200 }])).toHaveLength(
    1,
  );
});

it('rejects malformed backend series instead of inventing zero usage', () => {
  expect(() => seriesSchema.parse([{ ts: 'yesterday', energy_wh: 'unknown' }])).toThrow();
  expect(() => seriesSchema.parse([{ ts: '2026-11-21T09:00:00Z', energy_wh: -1 }])).toThrow();
});

it('keeps estimated device metrics and the null end of an ongoing cycle', () => {
  const device = deviceDetailSchema.parse({
    id: 'bcd1196b-18e7-42b4-aa3e-7cc4029c3ac9',
    name: 'Fridge',
    room: null,
    type: 'fridge',
    show_on_timeline: true,
    on: true,
    watts: 65,
    today_kwh: 0.25,
    month_kwh: 7.75,
    week_kwh: [0.25, 0.75, 0.5, 0.25, 0.75, 0.5, 0.25],
    typical_w: null,
    tip: null,
    avg_on_w: 60,
    peak_w: 80,
    home_share: 0.04,
    days: [{ date: '2026-11-21', kwh: 0.25 }],
    power: [{ ts: 1795248000000, watts: 65 }],
    cycles: [{ start: 1795248000000, end: null, kwh: 0.03 }],
  });

  expect(device.show_on_timeline).toBe(true);
  expect(device.cycles[0].end).toBeNull();
  expect(deviceEnergy(device, 'week')).toBe(3.25);
});

it('keeps numeric detector data and accepts a Vietnam-offset alert timestamp', () => {
  const alert = {
    id: '07d4a4fe-2861-469e-8341-e649245d84fa',
    kind: 'tier_near',
    severity: 'info',
    status: 'open',
    ts: '2026-11-21T09:00:00+07:00',
    resolved_at: null,
    device: null,
    payload: { tier_no: 2, from_kwh: 50, price_per_kwh: 2500, days: 2 },
  };

  expect(alertSchema.parse(alert)).toEqual(alert);
  expect(alertSchema.safeParse({ ...alert, payload: { days: '2' } }).success).toBe(false);
});
