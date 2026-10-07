import { workspaceListSchema, workspaceSchema, type CreateWorkspaceInput } from '@davegantt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

const WORKSPACES_QUERY_KEY = ['workspaces'] as const;

export function useWorkspaces() {
  return useQuery({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: () => apiRequest('GET', '/workspaces', { schema: workspaceListSchema }),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      apiRequest('POST', '/workspaces', { body: input, schema: workspaceSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY }),
  });
}
