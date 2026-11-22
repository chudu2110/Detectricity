import { energyBuckets, periodWindow } from './period';

it('advances the day and month at Vietnam midnight, independent of the phone timezone', () => {
  const before = new Date('2026-11-30T16:59:59.999Z');
  const midnight = new Date('2026-11-30T17:00:00.000Z');

  expect(periodWindow('day', before)).toEqual({
    since: '2026-11-29T17:00:00.000Z',
    until: '2026-11-30T17:00:00.000Z',
  });
  expect(periodWindow('day', midnight)).toEqual({
    since: '2026-11-30T17:00:00.000Z',
    until: '2026-12-01T17:00:00.000Z',
  });
  expect(periodWindow('month', before)).toEqual({
    since: '2026-10-31T17:00:00.000Z',
    until: '2026-11-30T17:00:00.000Z',
  });
  expect(periodWindow('month', midnight)).toEqual({
    since: '2026-11-30T17:00:00.000Z',
    until: '2026-12-31T17:00:00.000Z',
  });
});

it('includes today and the previous six Vietnam days across the year boundary', () => {
  expect(periodWindow('week', new Date('2027-01-02T03:00:00Z'))).toEqual({
    since: '2026-12-26T17:00:00.000Z',
    until: '2027-01-02T17:00:00.000Z',
  });
});

it('preserves missing and future hours as empty positions rather than zero readings', () => {
  const window = periodWindow('day', new Date('2026-11-21T04:00:00Z'));
  const buckets = energyBuckets(
    [
      { ts: window.since, energy_wh: 1000 },
      { ts: '2026-11-20T19:00:00Z', energy_wh: 500 },
    ],
    window.since,
    window.until,
    'day',
  );
  expect(buckets).toHaveLength(24);
  expect(buckets.slice(0, 3)).toEqual([1, undefined, 0.5]);
  expect(buckets[23]).toBeUndefined();
});
