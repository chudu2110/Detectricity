import { queryOptions } from '@tanstack/react-query';

import { fetchConversation, fetchConversations } from './api';

export const copilotKeys = {
  all: ['copilot'] as const,
  list: () => [...copilotKeys.all, 'conversations'] as const,
  detail: (id: string) => [...copilotKeys.list(), id] as const,
};

export const conversationListQuery = () =>
  queryOptions({
    queryKey: copilotKeys.list(),
    queryFn: ({ signal }) => fetchConversations(signal),
  });

export const conversationQuery = (id: string) =>
  queryOptions({
    queryKey: copilotKeys.detail(id),
    queryFn: ({ signal }) => fetchConversation(id, signal),
  });
