import { z } from 'zod';

import { apiClient } from '@/lib/session';

import {
  alertSchema,
  billHistorySchema,
  currentBillSchema,
  deviceDetailSchema,
  forecastSchema,
  goalSchema,
  homeSchema,
  liveDeviceSchema,
  overviewSchema,
  planSchema,
  provincesSchema,
  seriesSchema,
  simulationSchema,
  weatherSchema,
  type GoalInput,
  type HomeUpdate,
  type SimulationInput,
} from './schemas';

export const fetchOverview = (signal?: AbortSignal) =>
  apiClient.request('/energy/overview', { schema: overviewSchema, signal });

export const fetchDevices = (signal?: AbortSignal) =>
  apiClient.request('/energy/devices', { schema: z.array(liveDeviceSchema), signal });

export const fetchDevice = (id: string, signal?: AbortSignal) =>
  apiClient.request(`/energy/devices/${encodeURIComponent(id)}`, {
    schema: deviceDetailSchema,
    signal,
  });

export const fetchSeries = (since: string, until: string, signal?: AbortSignal, maxPoints = 24) =>
  apiClient.request(
    `/energy/series?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&max_points=${maxPoints}`,
    { schema: seriesSchema, signal },
  );

export const fetchWeather = (lang: 'en' | 'vi', signal?: AbortSignal) =>
  apiClient.request(`/energy/weather?lang=${lang}`, { schema: weatherSchema, signal });

export const fetchHome = (signal?: AbortSignal) =>
  apiClient.request('/homes/current', { schema: homeSchema, signal });

export const updateHome = (body: HomeUpdate) =>
  apiClient.request('/homes/current', { schema: homeSchema, method: 'PATCH', body });

export const fetchProvinces = (signal?: AbortSignal) =>
  apiClient.request('/homes/provinces', { schema: provincesSchema, signal });

export const fetchBill = (signal?: AbortSignal) =>
  apiClient.request('/billing/current', { schema: currentBillSchema, signal });

export const fetchForecast = (signal?: AbortSignal) =>
  apiClient.request('/billing/forecast', { schema: forecastSchema, signal });

export const fetchBillHistory = (signal?: AbortSignal) =>
  apiClient.request('/billing/history', { schema: billHistorySchema, signal });

export const fetchAlerts = (signal?: AbortSignal) =>
  apiClient.request('/insights/alerts?limit=20', { schema: z.array(alertSchema), signal });

export const acknowledgeAlert = (id: string) =>
  apiClient.request(`/insights/alerts/${encodeURIComponent(id)}`, {
    schema: z.undefined(),
    method: 'PATCH',
    body: { status: 'acknowledged' },
  });

export const fetchGoal = (signal?: AbortSignal) =>
  apiClient.request('/insights/goal', { schema: goalSchema.nullable(), signal });

export const saveGoal = (body: GoalInput) =>
  apiClient.request('/insights/goal', { schema: goalSchema, method: 'PUT', body });

export const deleteGoal = () =>
  apiClient.request('/insights/goal', { schema: z.undefined(), method: 'DELETE' });

export const simulateSaving = (body: SimulationInput) =>
  apiClient.request('/insights/simulate', { schema: simulationSchema, method: 'POST', body });

export const fetchPlans = (signal?: AbortSignal) =>
  apiClient.request('/copilot/plans', { schema: z.array(planSchema), signal });
