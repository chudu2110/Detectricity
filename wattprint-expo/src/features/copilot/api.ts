import { z } from 'zod';

import { ApiError, ContractError } from '@/lib/errors';
import { apiClient } from '@/lib/session';

import { readChatStream } from './chat-stream';
import {
  chatInputSchema,
  conversationSchema,
  conversationSummarySchema,
  conversationUpdateSchema,
  feedbackSchema,
  planSchema,
  transcriptSchema,
  type ChatEvent,
  type ChatInput,
  type ConversationUpdate,
  type Feedback,
  type Language,
} from './schemas';

const conversationPath = (id: string) => `/copilot/conversations/${encodeURIComponent(id)}`;
const messagePath = (id: string) => `/copilot/messages/${encodeURIComponent(id)}`;
const voiceTimeout = 90_000;

function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ContractError('Invalid Copilot input', parsed.error.issues);
  return parsed.data;
}

export function streamChat(
  input: ChatInput,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
) {
  return apiClient.stream(
    '/copilot/chat',
    { method: 'POST', body: validate(chatInputSchema, input), signal, timeoutMs: 120_000 },
    (stream, requestSignal) => readChatStream(stream, requestSignal, onEvent),
  );
}

export const fetchConversations = (signal?: AbortSignal) =>
  apiClient.request('/copilot/conversations', {
    schema: z.array(conversationSummarySchema),
    signal,
  });

export const fetchConversation = (id: string, signal?: AbortSignal) =>
  apiClient.request(conversationPath(id), { schema: conversationSchema, signal });

export const updateConversation = (id: string, patch: ConversationUpdate) =>
  apiClient.request(conversationPath(id), {
    method: 'PATCH',
    body: validate(conversationUpdateSchema, patch),
    schema: conversationSummarySchema,
  });

export const deleteConversation = (id: string) =>
  apiClient.request(conversationPath(id), { method: 'DELETE', schema: z.void() });

export const setFeedback = (id: string, value: Feedback) =>
  apiClient.request(`${messagePath(id)}/feedback`, {
    method: 'PUT',
    body: { value: validate(feedbackSchema, value) },
    schema: z.void(),
  });

export const acceptPlan = (id: string) =>
  apiClient.request(`/copilot/plans/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    schema: planSchema,
  });

export const maxAudioBytes = 10 * 1024 * 1024;

export function transcribeAudio(bytes: ArrayBuffer, lang: Language, signal: AbortSignal) {
  if (!bytes.byteLength) throw new ApiError(422, undefined, undefined);
  if (bytes.byteLength > maxAudioBytes) throw new ApiError(413, undefined, undefined);
  return apiClient.request(`/copilot/voice/transcribe?lang=${lang}`, {
    method: 'POST',
    rawBody: { bytes, contentType: 'audio/mp4' },
    schema: transcriptSchema,
    signal,
    timeoutMs: voiceTimeout,
  });
}

export const fetchSpeech = (id: string, lang: Language, signal: AbortSignal) =>
  apiClient.binary(`${messagePath(id)}/speech?lang=${lang}`, {
    contentType: 'audio/mpeg',
    signal,
    timeoutMs: voiceTimeout,
  });
