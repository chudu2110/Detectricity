import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';

import { ApiError, ContractError, NetworkError } from '@/lib/errors';
import { createApiClient } from '@/lib/http';

import { readChatStream } from './chat-stream';
import type { ChatEvent } from './schemas';

const id = 'a261ad39-9def-4d73-bf01-762a689d7d9a';
const answer = {
  intent: 'chat',
  tier: 'inferred',
  text: 'Điện năng 💡',
  steps: [],
  sql: null,
  sources: [],
  widgets: [],
  followUps: [],
};

beforeAll(() => {
  globalThis.TextDecoder ??= NodeTextDecoder as unknown as typeof TextDecoder;
});

function streamChunks(text: string) {
  const bytes = new NodeTextEncoder().encode(text);
  const source = new NodeReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  return source as unknown as ReadableStream<Uint8Array>;
}

const streamResponse = (body: ReadableStream<Uint8Array>) =>
  ({
    status: 200,
    ok: true,
    headers: { get: () => 'text/event-stream; charset=utf-8' },
    body,
  }) as unknown as Response;

it('streams split Vietnamese text after one 401 refresh and returns the final reply', async () => {
  const seen: ChatEvent[] = [];
  const nativeFetch = jest.fn<Promise<Response>, [string, RequestInit]>();
  nativeFetch.mockResolvedValueOnce({
    status: 401,
    ok: false,
    text: async () => '{"detail":"expired"}',
  } as Response);
  nativeFetch.mockResolvedValueOnce(
    streamResponse(
      streamChunks(
        [
          ': heartbeat\r\n\r\n',
          `event: meta\r\ndata: {"conversation_id":"${id}","message_id":"${id}"}\r\n\r\n`,
          'event: token\r\ndata: {\r\ndata: "text":"Điện năng 💡"}\r\n\r\n',
          `event: done\ndata: ${JSON.stringify({ message_id: id, reply: answer })}\n\n`,
        ].join(''),
      ),
    ),
  );
  const refreshAccessToken = jest.fn(async () => 'fresh');
  const client = createApiClient({
    baseUrl: 'https://api.test',
    nativeFetch,
    getAccessToken: () => 'old',
    refreshAccessToken,
  });

  await expect(
    client.stream('/copilot/chat', { method: 'POST', body: { question: 'Điện' } }, (body, signal) =>
      readChatStream(body, signal, (event) => seen.push(event)),
    ),
  ).resolves.toEqual(answer);
  expect(seen.map((event) => event.event)).toEqual(['meta', 'token', 'done']);
  expect(seen[1]).toEqual({ event: 'token', data: { text: answer.text } });
  expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(nativeFetch.mock.calls[1][1]).toMatchObject({
    body: '{"question":"Điện"}',
    headers: { Authorization: 'Bearer fresh', Accept: 'text/event-stream' },
  });
});

it('dispatches a terminal error event without exposing its payload in the thrown error', async () => {
  const onEvent = jest.fn();
  const body = streamChunks(
    'event: error\ndata: {"code":"provider","message":"provider detail","reply":null}\n\n',
  );
  const failed = readChatStream(body, new AbortController().signal, onEvent);
  await expect(failed).rejects.toMatchObject({ status: 502, message: 'HTTP 502' });
  expect(onEvent).toHaveBeenCalledWith({
    event: 'error',
    data: { code: 'provider', message: 'provider detail', reply: null },
  });
});

it.each([
  'event: token\ndata: {"text":"partial"}\n\n',
  'event: token\ndata: {"text":42}\n\n',
  'event: done\ndata: invalid\n\n',
])('rejects an incomplete or invalid stream', async (text) => {
  await expect(
    readChatStream(streamChunks(text), new AbortController().signal, jest.fn()),
  ).rejects.toBeInstanceOf(ContractError);
});

it('cancels the response body when the caller aborts while waiting for another chunk', async () => {
  const cancel = jest.fn();
  const body = new NodeReadableStream<Uint8Array>({
    cancel,
  }) as unknown as ReadableStream<Uint8Array>;
  const controller = new AbortController();
  const pending = readChatStream(body, controller.signal, jest.fn());
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('applies the request timeout while the response body is open', async () => {
  jest.useFakeTimers();
  try {
    const body = new NodeReadableStream<Uint8Array>() as unknown as ReadableStream<Uint8Array>;
    const client = createApiClient({
      baseUrl: 'https://api.test',
      nativeFetch: async () => streamResponse(body),
      timeoutMs: 20,
    });
    const failure = expect(
      client.stream('/copilot/chat', {}, (readable, signal) =>
        readChatStream(readable, signal, jest.fn()),
      ),
    ).rejects.toEqual(new NetworkError('Request timed out'));
    await jest.advanceTimersByTimeAsync(20);
    await failure;
  } finally {
    jest.useRealTimers();
  }
});

it('preserves the HTTP error status for a rejected speech provider', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    nativeFetch: async () =>
      ({
        status: 503,
        ok: false,
        text: async () => 'private provider detail',
      }) as Response,
  });
  await expect(client.binary('/speech', { contentType: 'audio/mpeg' })).rejects.toEqual(
    new ApiError(503, undefined, undefined),
  );
});
