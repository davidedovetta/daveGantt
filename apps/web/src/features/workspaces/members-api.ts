import { memberListSchema, memberSchema, type AddMemberInput, type Role } from '@davegantt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

const membersKey = (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const;

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: membersKey(workspaceId),
    queryFn: () =>
      apiRequest('GET', `/workspaces/${workspaceId}/members`, { schema: memberListSchema }),
  });
}

/** Member changes can alter the caller's own role or access, so the workspace list is refreshed too. */
function useInvalidateMembership(workspaceId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: ['workspaces'], exact: true }),
    ]);
}

export function useAddMember(workspaceId: string) {
  const invalidate = useInvalidateMembership(workspaceId);
  return useMutation({
    mutationFn: (input: AddMemberInput) =>
      apiRequest('POST', `/workspaces/${workspaceId}/members`, {
        body: input,
        schema: memberSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const invalidate = useInvalidateMembership(workspaceId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      apiRequest('PATCH', `/workspaces/${workspaceId}/members/${userId}`, {
        body: { role },
        schema: memberSchema,
      }),
    onSettled: invalidate,
  });
}

export function useRemoveMember(workspaceId: string) {
  const invalidate = useInvalidateMembership(workspaceId);
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest('DELETE', `/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: invalidate,
  });
}
