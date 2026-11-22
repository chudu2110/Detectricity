import { ApiError, ContractError } from '@/lib/errors';

import { chatEventSchema, type ChatEvent, type Reply } from './schemas';

const MAX_EVENT_CHARS = 1_000_000;

function readEvent(event: string, data: string[]) {
  let payload: unknown;
  try {
    payload = JSON.parse(data.join('\n'));
  } catch {
    throw new ContractError('Invalid chat event JSON', []);
  }
  const parsed = chatEventSchema.safeParse({ event, data: payload });
  if (!parsed.success) throw new ContractError('Invalid chat event', parsed.error.issues);
  return parsed.data;
}

export async function readChatStream(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onEvent: (event: ChatEvent) => void,
): Promise<Reply> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let line = '';
  let sawCR = false;
  let event = '';
  let data: string[] = [];
  let eventSize = 0;
  const cancel = () => void reader.cancel().catch(() => {});

  signal.addEventListener('abort', cancel);
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
      const chunk = await reader.read();
      if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
      if (chunk.done) throw new ContractError('Chat stream ended before completion', []);

      let text: string;
      try {
        text = decoder.decode(chunk.value, { stream: true });
      } catch {
        throw new ContractError('Invalid chat stream encoding', []);
      }

      for (const char of text) {
        if (char === '\n' && sawCR) {
          sawCR = false;
          continue;
        }
        sawCR = char === '\r';
        if (char !== '\r' && char !== '\n') {
          line += char;
          if (++eventSize > MAX_EVENT_CHARS) throw new ContractError('Chat event too large', []);
          continue;
        }

        if (!line) {
          if (data.length) {
            const message = readEvent(event, data);
            onEvent(message);
            if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
            if (message.event === 'done') return message.data.reply;
            if (message.event === 'error') throw new ApiError(502, undefined, undefined);
          }
          event = '';
          data = [];
          eventSize = 0;
        } else if (!line.startsWith(':')) {
          const separator = line.indexOf(':');
          const field = separator < 0 ? line : line.slice(0, separator);
          const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '');
          if (field === 'event') event = value;
          if (field === 'data') data.push(value);
        }
        line = '';
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
    reader.releaseLock();
  }
}
