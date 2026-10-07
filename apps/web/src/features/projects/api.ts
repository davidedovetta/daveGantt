import {
  projectDetailSchema,
  projectListSchema,
  projectSchema,
  taskSchema,
  type CreateProjectInput,
  type CreateTaskInput,
  type MoveTaskInput,
  type ProjectDetail,
  type Task,
  type UpdateProjectInput,
  type UpdateTaskInput,
} from '@davegantt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

const projectsKey = (workspaceId: string) => ['workspaces', workspaceId, 'projects'] as const;
const projectKey = (projectId: string) => ['projects', projectId] as const;

/** How often an open project is re-fetched to pick up colleagues' changes. */
const PROJECT_REFRESH_MS = 20_000;

export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: projectsKey(workspaceId),
    queryFn: () =>
      apiRequest('GET', `/workspaces/${workspaceId}/projects`, { schema: projectListSchema }),
  });
}

export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiRequest('POST', `/workspaces/${workspaceId}/projects`, {
        body: input,
        schema: projectSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey(workspaceId) }),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKey(projectId),
    queryFn: () => apiRequest('GET', `/projects/${projectId}`, { schema: projectDetailSchema }),
    refetchInterval: PROJECT_REFRESH_MS,
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      apiRequest('PATCH', `/projects/${projectId}`, { body: input, schema: projectSchema }),
    onSuccess: (project) => {
      queryClient.setQueryData<ProjectDetail>(projectKey(projectId), (old) =>
        old ? { ...old, project } : old,
      );
      return queryClient.invalidateQueries({ queryKey: projectsKey(project.workspaceId) });
    },
  });
}

export function useArchiveProject(projectId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('DELETE', `/projects/${projectId}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: projectKey(projectId) });
      return queryClient.invalidateQueries({ queryKey: projectsKey(workspaceId) });
    },
  });
}

export type TaskChanges = Omit<UpdateTaskInput, 'version'>;

/**
 * Optimistic task update. Updates of one project run one at a time (mutation scope) and read
 * the task version from the cache when they start, so quick consecutive edits don't conflict
 * with each other. Any error re-fetches the project.
 */
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  const key = projectKey(projectId);
  return useMutation({
    scope: { id: `tasks-${projectId}` },
    mutationFn: ({ taskId, changes }: { taskId: string; changes: TaskChanges }) => {
      const current = queryClient
        .getQueryData<ProjectDetail>(key)
        ?.tasks.find((t) => t.id === taskId);
      if (!current) throw new Error('Task not in cache');
      return apiRequest('PATCH', `/tasks/${taskId}`, {
        body: { ...changes, version: current.version },
        schema: taskSchema,
      });
    },
    onMutate: async ({ taskId, changes }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProjectDetail>(key);
      queryClient.setQueryData<ProjectDetail>(
        key,
        (old) => old && replaceTask(old, taskId, (t) => ({ ...t, ...changes })),
      );
      return { previous };
    },
    onSuccess: (task) => {
      queryClient.setQueryData<ProjectDetail>(
        key,
        (old) => old && replaceTask(old, task.id, () => task),
      );
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      return queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

function replaceTask(detail: ProjectDetail, taskId: string, fn: (t: Task) => Task): ProjectDetail {
  return { ...detail, tasks: detail.tasks.map((t) => (t.id === taskId ? fn(t) : t)) };
}

/** Create/move/delete change ordering or hierarchy: simply re-fetch the project afterwards. */
function useProjectMutation<V>(projectId: string, mutationFn: (vars: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `tasks-${projectId}` },
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: projectKey(projectId) }),
  });
}

export const useCreateTask = (projectId: string) =>
  useProjectMutation(projectId, (input: CreateTaskInput) =>
    apiRequest('POST', `/projects/${projectId}/tasks`, { body: input, schema: taskSchema }),
  );

export const useMoveTask = (projectId: string) =>
  useProjectMutation(projectId, ({ taskId, ...input }: MoveTaskInput & { taskId: string }) =>
    apiRequest('POST', `/tasks/${taskId}/move`, { body: input, schema: taskSchema }),
  );

export const useDeleteTask = (projectId: string) =>
  useProjectMutation(projectId, (taskId: string) => apiRequest('DELETE', `/tasks/${taskId}`));
