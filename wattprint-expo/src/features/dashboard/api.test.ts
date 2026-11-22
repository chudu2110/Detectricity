import { ApiError, ContractError } from '@/lib/errors';

import { acknowledgeAlert, fetchBill, fetchForecast, updateHome } from './api';

jest.mock('@/lib/session', () => ({
  apiClient: jest
    .requireActual<typeof import('@/lib/http')>('@/lib/http')
    .createApiClient({ baseUrl: 'https://api.test', getAccessToken: () => 'test-token' }),
}));

function respond(status: number, body?: unknown) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
  return jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);
}

afterEach(() => {
  jest.restoreAllMocks();
});

it('preserves the backend decimal area and sends the owner’s partial home update', async () => {
  const fetch = respond(200, {
    id: '13a6e1bf-352e-4ea4-9814-239443ae4e5a',
    name: 'Home',
    home_type: 'apartment',
    floor_area_m2: '56.70',
    occupants: null,
    billing_cycle_day: 14,
    province_code: null,
    role: 'owner',
  });
  await expect(updateHome({ floor_area_m2: '56.70', occupants: null })).resolves.toMatchObject({
    floor_area_m2: '56.70',
    occupants: null,
    role: 'owner',
  });
  expect(fetch).toHaveBeenCalledWith(
    'https://api.test/homes/current',
    expect.objectContaining({
      method: 'PATCH',
      body: '{"floor_area_m2":"56.70","occupants":null}',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }),
  );
});

it('accepts a bodyless 204 when acknowledging an alert', async () => {
  const fetch = respond(204);
  await expect(acknowledgeAlert('alert-id')).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledWith(
    'https://api.test/insights/alerts/alert-id',
    expect.objectContaining({ method: 'PATCH', body: '{"status":"acknowledged"}' }),
  );
});

it('preserves backend billing values and the open-ended tariff tier', async () => {
  const bill = {
    period_start: '2026-11-14',
    period_end: '2026-12-14',
    status: 'running',
    coverage: 0.96,
    tariff_straddle: false,
    vat_rate: 0.08,
    kwh: 489.1,
    amount_before_vat: 1234567,
    vat_amount: 98765.36,
    amount_total: 1333332.36,
    tier_no: 6,
    tiers: [
      { tier_no: 6, from_kwh: 400, to_kwh: null, price_per_kwh: 3460, kwh: 89.1, amount: 308286 },
    ],
    today_kwh: 8.9,
    today_amount: 30794,
  };
  respond(200, bill);
  await expect(fetchBill()).resolves.toEqual(bill);
  respond(200, { ...bill, amount_total: '1333332.36' });
  await expect(fetchBill()).rejects.toBeInstanceOf(ContractError);
});

it('preserves unavailable forecasts as a typed 404', async () => {
  respond(404, { detail: 'Not enough full days of readings to forecast yet' });
  const result = fetchForecast();
  await expect(result).rejects.toBeInstanceOf(ApiError);
  await expect(result).rejects.toMatchObject({ status: 404 });
});
