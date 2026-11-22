import type { LiveDevice } from './schemas';

const VIETNAM_OFFSET = 7 * 60 * 60 * 1000;

export type EnergyPeriod = 'day' | 'week' | 'month';

export function energyBuckets(
  points: readonly { ts: string; energy_wh: number }[],
  since: string,
  until: string,
  period: EnergyPeriod,
) {
  const start = Date.parse(since);
  const step = (period === 'day' ? 1 : 24) * 60 * 60 * 1000;
  const buckets: (number | undefined)[] = Array.from({
    length: Math.ceil((Date.parse(until) - start) / step),
  });
  for (const point of points) {
    const index = Math.floor((Date.parse(point.ts) - start) / step);
    if (index >= 0 && index < buckets.length)
      buckets[index] = (buckets[index] ?? 0) + point.energy_wh / 1000;
  }
  return buckets;
}

export function periodWindow(period: EnergyPeriod, now = new Date()) {
  // The backend stores all homes in Vietnam (UTC+7, no daylight saving).
  const local = new Date(now.getTime() + VIETNAM_OFFSET);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const startDay = period === 'week' ? day - 6 : day;
  const start = Date.UTC(year, month, period === 'month' ? 1 : startDay);
  const end = period === 'month' ? Date.UTC(year, month + 1, 1) : Date.UTC(year, month, day + 1);

  return {
    since: new Date(start - VIETNAM_OFFSET).toISOString(),
    until: new Date(end - VIETNAM_OFFSET).toISOString(),
  };
}

export function deviceEnergy(device: LiveDevice, period: EnergyPeriod) {
  switch (period) {
    case 'day':
      return device.today_kwh;
    case 'week':
      return device.week_kwh.reduce((total, kwh) => total + kwh, 0);
    case 'month':
      return device.month_kwh;
  }
}
