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

export const goalSchema = z.object({
  kind: z.enum(['kwh', 'vnd']),
  target: z.number(),
  period_start: day,
  period_end: day,
  used: z.number(),
  projected: z.number().nullable(),
  status: z.enum(['on_track', 'over', 'no_forecast']),
  excess: z.number(),
  cut_kwh: z.number().nullable(),
  days_left: z.number().int(),
  left_per_day: z.number().nullable(),
  devices: z.array(
    z.object({ id: z.string(), name: z.string(), kwh: z.number(), share: z.number() }),
  ),
});

export type Goal = z.output<typeof goalSchema>;
export type GoalInput = { kind: Goal['kind']; target: number };

export const simulationSchema = z.object({
  device: z.string(),
  watts_when_on: z.number(),
  hours_per_day: z.number(),
  hours_per_day_cut: z.number(),
  new_watts: z.number().nullable(),
  kwh_per_month_before: z.number(),
  kwh_per_month_after: z.number(),
  kwh_per_month_saved: z.number(),
  vnd_per_month_saved: z.number().nullable(),
  price_vnd: z.number().nullable(),
  payback_months: z.number().nullable(),
});

export type Simulation = z.output<typeof simulationSchema>;
export type SimulationInput = {
  device_id: string;
  hours_per_day_less?: number;
  new_watts?: number;
  price_vnd?: number;
};

const planMeasureSchema = z.object({
  status: z.enum(['measuring', 'measured', 'not_enough_data']),
  trial_day: z.number().int(),
  trial_days: z.number().int(),
  days_with_data_before: z.number().int(),
  days_with_data_after: z.number().int(),
  min_days: z.number().int().nullish(),
  kwh_per_month_saved: z.number().nullish(),
  kwh_per_month_margin: z.number().nullish(),
  clear: z.boolean().nullish(),
  vnd_per_month_saved: z.number().nullish(),
});

export const planSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  started_at: dateTime.nullable(),
  tasks: z.array(z.string()),
  expected_kwh_per_month: z.number().nullable(),
  expected_vnd_per_month: z.number().nullable(),
  measure: planMeasureSchema.nullable(),
});

export type Plan = z.output<typeof planSchema>;
