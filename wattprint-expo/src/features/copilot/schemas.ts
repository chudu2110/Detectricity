import { z } from 'zod';

const id = z.uuid();
export const languageSchema = z.enum(['vi', 'en']);
export const chatInputSchema = z.object({
  conversation_id: id.nullish(),
  question: z.string().trim().min(1).max(2000),
  lang: languageSchema,
});

const stepSchema = z.object({ tool: z.string().optional(), label: z.string(), detail: z.string() });
export const replySchema = z.object({
  intent: z.string(),
  tier: z.string(),
  steps: z.array(stepSchema),
  sql: z.string().nullable(),
  text: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
  widgets: z.array(z.unknown()),
  followUps: z.array(z.string()),
});

export const chatEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('meta'),
    data: z.object({ conversation_id: id, message_id: id }),
  }),
  z.object({ event: z.literal('step'), data: stepSchema }),
  z.object({ event: z.literal('token'), data: z.object({ text: z.string() }) }),
  z.object({
    event: z.literal('done'),
    data: z.object({ message_id: id, reply: replySchema }),
  }),
  z.object({
    event: z.literal('error'),
    data: z.object({ code: z.string(), message: z.string(), reply: replySchema.nullable() }),
  }),
]);

export const feedbackSchema = z.enum(['up', 'down']).nullable();
export const conversationSummarySchema = z.object({
  id,
  title: z.string().nullable(),
  pinned: z.boolean(),
  updated_at: z.iso.datetime({ offset: true }),
});

const messageSchema = z.object({
  id,
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  reply: replySchema.nullable(),
  feedback: feedbackSchema,
  created_at: z.iso.datetime({ offset: true }),
});

export const conversationSchema = conversationSummarySchema.extend({
  messages: z.array(messageSchema),
});

export const conversationUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).nullish(),
  pinned: z.boolean().nullish(),
});

export const planSchema = z.object({ id, status: z.string() });
export const transcriptSchema = z.object({
  text: z.string(),
  language: z.string().nullable(),
  duration: z.number().nullable(),
});

export type Language = z.infer<typeof languageSchema>;
export type ChatInput = z.infer<typeof chatInputSchema>;
export type ChatEvent = z.infer<typeof chatEventSchema>;
export type Reply = z.infer<typeof replySchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type ConversationUpdate = z.infer<typeof conversationUpdateSchema>;
