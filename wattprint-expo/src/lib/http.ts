import type { z } from 'zod';

import { ApiError, ContractError, NetworkError, type ApiErrorDetail } from './errors';

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  // Returns a new access token, or null when the session cannot be refreshed.
  // Must call the client with `auth: false` (a 401 there must not trigger another refresh).
  refreshAccessToken?: () => Promise<string | null>;
  onSessionExpired?: () => void;
  timeoutMs?: number;
  // Expo fetch is used for streaming responses and raw binary bodies.
  nativeFetch?: (url: string, init: RequestInit) => Promise<Response>;
  // Called once per HTTP attempt (a retry after a refresh is a second call), `status` 0 when no
  // response arrived. An exception from the hook is swallowed.
  // The hook sees the path including its query string: never put tokens or secrets in URLs.
  onRequest?: (info: RequestLog) => void;
};

export type RequestLog = { method: string; path: string; status: number; ms: number };

export type RequestOptions<S extends z.ZodType> = {
  schema: S;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  // Default true. false: no Authorization header, no refresh, no onSessionExpired (login, refresh).
  auth?: boolean;
};

type TransportOptions = Omit<RequestOptions<z.ZodType>, 'schema'> & {
  timeoutMs?: number;
  rawBody?: { bytes: ArrayBuffer; contentType: string };
};
type Result<T> = { status: number } & ({ ok: true; value: T } | { ok: false; text: string });

const DEFAULT_TIMEOUT_MS = 15_000;

function fetchNative(url: string, init: RequestInit): Promise<Response> {
  // Metro's development chunks can stall an async import before the request even starts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const native = require('expo/fetch') as typeof import('expo/fetch');
  return native.fetch(url, init);
}

function abortError(): Error {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  if (text === '') return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function errorDetail(body: unknown): ApiErrorDetail {
  if (typeof body !== 'object' || body === null || !('detail' in body)) return undefined;
  const { detail } = body;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const items = detail.filter(
      (d): d is { msg: string } =>
        typeof d === 'object' && d !== null && typeof (d as { msg?: unknown }).msg === 'string',
    );
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

function mediaType(response: Response) {
  return response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, getAccessToken, refreshAccessToken, onSessionExpired, onRequest } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let refreshing: Promise<string | null> | null = null;

  // Concurrent 401s share one refresh; the slot is freed once it settles. A refresh that yields
  // no token expires the session, once per settled refresh.
  function refreshOnce(): Promise<string | null> {
    refreshing ??= (async () => {
      let rejected = true;
      const token = refreshAccessToken
        ? await refreshAccessToken().catch((error: unknown) => {
            // A refresh that could not be completed (offline, timeout) proves nothing about the
            // session: keep it. Only "no token" or an explicit 401 means the session is over.
            rejected = error instanceof ApiError && error.status === 401;
            return null;
          })
        : null;
      if (!token && rejected) onSessionExpired?.();
      return token;
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function send<T>(
    path: string,
    opts: TransportOptions,
    token: string | null,
    read: (response: Response, signal: AbortSignal) => Promise<T>,
    useNative: boolean,
  ): Promise<Result<T>> {
    const { signal } = opts;
    if (signal?.aborted) throw abortError();

    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, opts.timeoutMs ?? timeoutMs);

    const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
    if (opts.rawBody) headers['Content-Type'] = opts.rawBody.contentType;
    else if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const method = opts.method ?? 'GET';
    const startedAt = Date.now();
    let status = 0;

    try {
      const fetcher = useNative ? (options.nativeFetch ?? fetchNative) : fetch;
      const response = await fetcher(`${baseUrl}${path}`, {
        method,
        headers,
        body:
          opts.rawBody?.bytes ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
        signal: controller.signal,
      });
      status = response.status;
      const result: Result<T> = response.ok
        ? { status, ok: true, value: await read(response, controller.signal) }
        : { status, ok: false, text: await response.text() };
      if (controller.signal.aborted) throw abortError();
      return result;
    } catch (error) {
      if (timedOut)
        throw new NetworkError('Request timed out', useNative ? undefined : { cause: error });
      if (signal?.aborted) throw abortError();
      if (error instanceof ContractError || error instanceof ApiError) throw error;
      if (useNative) throw new NetworkError('Network request failed');
      throw new NetworkError('Network request failed', { cause: error });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      try {
        onRequest?.({ method, path, status, ms: Date.now() - startedAt });
      } catch {
        // Instrumentation must never break a request.
      }
    }
  }

  async function perform<T>(
    path: string,
    opts: TransportOptions,
    read: (response: Response, signal: AbortSignal) => Promise<T>,
    useNative = false,
  ): Promise<T> {
    if (opts.signal?.aborted) throw abortError();
    const auth = opts.auth !== false;
    const sentToken = auth ? ((await getAccessToken?.()) ?? null) : null;
    let result = await send(path, opts, sentToken, read, useNative);

    if (result.status === 401 && sentToken) {
      if (opts.signal?.aborted) throw abortError();
      // Another request may already have refreshed while this one was in flight.
      const current = (await getAccessToken?.()) ?? null;
      const token = current && current !== sentToken ? current : await refreshOnce();
      if (token) {
        result = await send(path, opts, token, read, useNative);
        if (result.status === 401) onSessionExpired?.();
      }
    }

    if (opts.signal?.aborted) throw abortError();
    if (result.ok) return result.value;
    if (useNative) throw new ApiError(result.status, undefined, undefined);
    const json = parseJson(result.text);
    const body = json.ok ? json.value : result.text;
    throw new ApiError(result.status, errorDetail(body), body);
  }

  async function request<S extends z.ZodType>(
    path: string,
    opts: RequestOptions<S> & Pick<TransportOptions, 'rawBody' | 'timeoutMs'>,
  ): Promise<z.output<S>> {
    const text = await perform(path, opts, (response) => response.text(), Boolean(opts.rawBody));
    const json = parseJson(text);
    if (!json.ok) throw new ContractError('Response is not valid JSON', []);

    const parsed = opts.schema.safeParse(json.value);
    if (!parsed.success) {
      throw new ContractError(`Response does not match the schema (${path})`, parsed.error.issues);
    }
    return parsed.data;
  }

  function stream<T>(
    path: string,
    opts: Omit<TransportOptions, 'rawBody'>,
    read: (body: ReadableStream<Uint8Array>, signal: AbortSignal) => Promise<T>,
  ) {
    return perform(
      path,
      { ...opts, headers: { ...opts.headers, Accept: 'text/event-stream' } },
      async (response, signal) => {
        if (!response.body || mediaType(response) !== 'text/event-stream') {
          throw new ContractError('Expected an event stream', []);
        }
        return read(response.body, signal);
      },
      true,
    );
  }

  function binary(path: string, opts: Omit<TransportOptions, 'rawBody'> & { contentType: string }) {
    return perform(
      path,
      { ...opts, headers: { ...opts.headers, Accept: opts.contentType } },
      async (response) => {
        if (mediaType(response) !== opts.contentType) {
          throw new ContractError('Unexpected binary response type', []);
        }
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength) throw new ContractError('Empty binary response', []);
        return bytes;
      },
      true,
    );
  }

  return { request, stream, binary };
}

export type ApiClient = ReturnType<typeof createApiClient>;
