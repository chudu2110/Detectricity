import { z } from 'zod';

import { apiClient } from '@/lib/session';

export const sourceSchema = z.object({
  id: z.string(),
  kind: z.enum(['plug', 'csv', 'meter']),
  name: z.string(),
  room: z.string().nullable(),
  device_id: z.string().nullable(),
  created_at: z.string(),
  latest_kwh: z.coerce.number().nullable(),
  latest_at: z.string().nullable(),
  readings: z.number(),
  consumed_kwh: z.coerce.number().nullable(),
});

export const plugSchema = z.object({
  device_id: z.string(),
  plug_name: z.string(),
  device_name: z.string(),
  assigned_name: z.string().nullable(),
  room: z.string().nullable(),
  online: z.boolean(),
  simulated: z.boolean(),
});

export const csvPreviewSchema = z.object({
  devices: z.array(z.string()),
  needs_device_name: z.boolean(),
  rows: z.number(),
});

export type DataSource = z.infer<typeof sourceSchema>;
export type DemoPlug = z.infer<typeof plugSchema>;

export const fetchSources = () =>
  apiClient.request('/energy/sources', { schema: z.array(sourceSchema) });

export const discoverPlugs = () =>
  apiClient.request('/energy/sources/plugs/discover', { schema: z.array(plugSchema) });

export const addPlug = (device_id: string, name: string) =>
  apiClient.request('/energy/sources/plugs', {
    method: 'POST',
    body: { device_id, name },
    schema: z.object({ id: z.string(), name: z.string(), kind: z.literal('plug') }),
  });

export const renamePlug = (id: string, name: string, room: string | null) =>
  apiClient.request(`/energy/sources/${id}`, {
    method: 'PATCH',
    body: { name, room },
    schema: z.object({ id: z.string(), name: z.string(), room: z.string().nullable() }),
  });

export const previewCsv = (csv_text: string) =>
  apiClient.request('/energy/sources/csv/preview', {
    method: 'POST',
    body: { csv_text },
    schema: csvPreviewSchema,
    timeoutMs: 30_000,
  });

export const importCsv = (csv_text: string, device_name?: string) =>
  apiClient.request('/energy/sources/csv/import', {
    method: 'POST',
    body: { csv_text, device_name },
    schema: z.object({ sources: z.number(), rows: z.number() }),
    timeoutMs: 60_000,
  });

export const recordMeter = (name: string, reading_kwh: number, recorded_on: string) =>
  apiClient.request('/energy/sources/meters', {
    method: 'POST',
    body: { name, reading_kwh, recorded_on },
    schema: z.object({
      id: z.string(),
      name: z.string(),
      reading_kwh: z.coerce.number(),
      usage_kwh: z.coerce.number().nullable(),
    }),
  });
