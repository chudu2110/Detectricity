import { z } from 'zod';

const dateTime = z.iso.datetime({ offset: true });
const day = z.iso.date();

export const overviewSchema = z.object({
  live: z.object({ ts: z.iso.datetime({ offset: true }), watts: z.number() }).nullable(),
  today: z.object({ kwh: z.number(), typical_kwh: z.number().nullable() }).nullable(),
});

export const liveDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  room: z.string().nullable(),
  type: z.string(),
  show_on_timeline: z.boolean(),
  on: z.boolean(),
  watts: z.number(),
  today_kwh: z.number(),
  month_kwh: z.number(),
  week_kwh: z.array(z.number()),
});

export type LiveDevice = z.output<typeof liveDeviceSchema>;

export const deviceDetailSchema = liveDeviceSchema.extend({
  typical_w: z.number().int().nullable(),
  tip: z.string().nullable(),
  avg_on_w: z.number(),
  peak_w: z.number(),
  home_share: z.number(),
  days: z.array(z.object({ date: day, kwh: z.number() })),
  power: z.array(z.object({ ts: z.number().int(), watts: z.number() })),
  cycles: z.array(
    z.object({ start: z.number().int(), end: z.number().int().nullable(), kwh: z.number() }),
  ),
});

export type DeviceDetail = z.output<typeof deviceDetailSchema>;

export const homeSchema = z.object({
  id: z.string(),
  name: z.string(),
  home_type: z.enum(['apartment', 'house', 'other']).nullable(),
  floor_area_m2: z
    .string()
    .regex(/^\d+(?:\.\d+)?$/)
    .nullable(),
  occupants: z.number().int().nullable(),
  billing_cycle_day: z.number().int(),
  province_code: z.string().nullable(),
  role: z.enum(['owner', 'member']),
});

export type Home = z.output<typeof homeSchema>;
export type HomeCreate = Pick<Home, 'name' | 'province_code' | 'billing_cycle_day'>;
export type HomeUpdate = Partial<
  Omit<Home, 'id' | 'role' | 'floor_area_m2'> & { floor_area_m2: string | number | null }
>;

export const provincesSchema = z.array(z.object({ code: z.string(), name: z.string() }));

const billingPeriodSchema = z.object({
  period_start: day,
  period_end: day,
  kwh: z.number(),
});

const tariffTierSchema = z.object({
  tier_no: z.number().int(),
  from_kwh: z.number(),
  price_per_kwh: z.number(),
});

export const currentBillSchema = billingPeriodSchema.extend({
  status: z.string(),
  coverage: z.number(),
  tariff_straddle: z.boolean(),
  vat_rate: z.number(),
  amount_before_vat: z.number(),
  vat_amount: z.number(),
  amount_total: z.number(),
  tier_no: z.number().int(),
  tiers: z.array(
    tariffTierSchema.extend({
      to_kwh: z.number().nullable(),
      kwh: z.number(),
      amount: z.number(),
    }),
  ),
  today_kwh: z.number(),
  today_amount: z.number(),
});

export const billHistorySchema = z.array(
  billingPeriodSchema.extend({
    amount: z.number(),
    coverage: z.number(),
    tariff_straddle: z.boolean(),
  }),
);

export const forecastSchema = billingPeriodSchema.extend({
  amount: z.number(),
  tier_no: z.number().int(),
  next: tariffTierSchema.extend({ on: day }).nullable(),
  basis_days: z.number().int(),
  as_of: day,
});

export const alertSchema = z.object({
  id: z.string(),
  kind: z.string(),
  severity: z.string(),
  status: z.string(),
  ts: dateTime,
  resolved_at: dateTime.nullable(),
  device: liveDeviceSchema.pick({ id: true, name: true, type: true }).nullable(),
  payload: z.record(z.string(), z.number()),
});

export type Alert = z.output<typeof alertSchema>;

export const seriesSchema = z.array(
  z.object({ ts: z.iso.datetime({ offset: true }), energy_wh: z.number().nonnegative() }),
);

const weatherSky = z.object({ description: z.string(), icon: z.string().optional() });
const weatherSlot = z.object({
  dt: z.number().int(),
  temp: z.number(),
  pop: z.number().min(0).max(1),
  sky: weatherSky,
});
export const weatherSchema = z.object({
  province: z.string(),
  now: z.object({
    temp: z.number(),
    humidity: z.number(),
    sky: weatherSky,
  }),
  next: z.array(weatherSlot).optional(),
});
export type WeatherReading = z.output<typeof weatherSchema>;
export type WeatherForecastSlot = z.output<typeof weatherSlot>;
