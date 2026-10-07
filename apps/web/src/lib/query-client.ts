import { QueryCache, QueryClient } from '@tanstack/react-query';
import { isUnauthorized } from './api';

export const ME_QUERY_KEY = ['me'] as const;

export const queryClient: QueryClient = new QueryClient({
  // A 401 on any query means the session is gone: drop the user so routes redirect to login.
  queryCache: new QueryCache({
    onError: (err) => {
      if (isUnauthorized(err)) queryClient.setQueryData(ME_QUERY_KEY, null);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, err) => !isUnauthorized(err) && failureCount < 1,
    },
  },
});
