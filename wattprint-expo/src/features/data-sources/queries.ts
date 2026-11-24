import { queryOptions } from '@tanstack/react-query';

import { discoverPlugs, fetchSources } from './api';

export const sourceKeys = {
  list: ['data-sources'] as const,
  plugs: ['demo-plugs'] as const,
};

export const sourcesQuery = () =>
  queryOptions({ queryKey: sourceKeys.list, queryFn: fetchSources, staleTime: 30_000 });

export const plugsQuery = () =>
  queryOptions({ queryKey: sourceKeys.plugs, queryFn: discoverPlugs, staleTime: 30_000 });
