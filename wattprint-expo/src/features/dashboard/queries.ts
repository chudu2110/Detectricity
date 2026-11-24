import { queryOptions } from '@tanstack/react-query';

import {
  fetchAlerts,
  fetchBill,
  fetchBillHistory,
  fetchDevice,
  fetchDevices,
  fetchForecast,
  fetchGoal,
  fetchHome,
  fetchOverview,
  fetchPlans,
  fetchProvinces,
  fetchSeries,
  fetchWeather,
} from './api';

export const overviewQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'overview'],
    queryFn: ({ signal }) => fetchOverview(signal),
    refetchInterval: 15_000,
  });

export const devicesQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'devices'],
    queryFn: ({ signal }) => fetchDevices(signal),
    refetchInterval: 30_000,
  });

export const deviceQuery = (id: string) =>
  queryOptions({
    queryKey: ['dashboard', 'device', id],
    queryFn: ({ signal }) => fetchDevice(id, signal),
  });

export const seriesQuery = (since: string, until: string, maxPoints = 24) =>
  queryOptions({
    queryKey: ['dashboard', 'series', since, until, maxPoints],
    queryFn: ({ signal }) => fetchSeries(since, until, signal, maxPoints),
  });

export const weatherQuery = (lang: 'en' | 'vi') =>
  queryOptions({
    queryKey: ['dashboard', 'weather', lang],
    queryFn: ({ signal }) => fetchWeather(lang, signal),
    staleTime: 600_000,
  });

export const homeQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'home'],
    queryFn: ({ signal }) => fetchHome(signal),
  });

export const provincesQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'provinces'],
    queryFn: ({ signal }) => fetchProvinces(signal),
    staleTime: 600_000,
  });

export const billQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'bill'],
    queryFn: ({ signal }) => fetchBill(signal),
  });

export const forecastQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'forecast'],
    queryFn: ({ signal }) => fetchForecast(signal),
  });

export const billHistoryQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'bill-history'],
    queryFn: ({ signal }) => fetchBillHistory(signal),
  });

export const alertsQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'alerts'],
    queryFn: ({ signal }) => fetchAlerts(signal),
  });

export const goalQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'goal'],
    queryFn: ({ signal }) => fetchGoal(signal),
  });

export const plansQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'plans'],
    queryFn: ({ signal }) => fetchPlans(signal),
  });
