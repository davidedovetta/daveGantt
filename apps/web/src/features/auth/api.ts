import {
  meResponseSchema,
  type LoginInput,
  type RegisterInput,
  type User,
} from '@davegantt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, isUnauthorized } from '../../lib/api';
import { ME_QUERY_KEY } from '../../lib/query-client';

/** Current user, or `null` when not logged in. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<User | null> => {
      try {
        return (await apiRequest('GET', '/auth/me', { schema: meResponseSchema })).user;
      } catch (err) {
        if (isUnauthorized(err)) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiRequest('POST', '/auth/login', { body: input, schema: meResponseSchema }),
    onSuccess: ({ user }) => {
      // Drop anything cached for a previous user in this tab.
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiRequest('POST', '/auth/register', { body: input, schema: meResponseSchema }),
    onSuccess: ({ user }) => {
      // Drop anything cached for a previous user in this tab.
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('POST', '/auth/logout'),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, null);
    },
  });
}
