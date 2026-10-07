import { hasMinRole } from '@davegantt/shared';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, FormError, FullPageMessage } from '../../components/ui';
import { ApiError, errorMessage } from '../../lib/api';
import { useMembers } from '../workspaces/members-api';
import { ROLE_LABELS } from '../workspaces/roles';
import { useWorkspaces } from '../workspaces/api';
import { useArchiveProject, useProject, useUpdateProject } from './api';
import { TextCell } from './cells';
import { TaskTable } from './TaskTable';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);

  if (project.isPending) return <FullPageMessage>Caricamento…</FullPageMessage>;
  if (project.isError) {
    return (
      <FullPageMessage>
        {project.error instanceof ApiError && project.error.status === 404
          ? 'Progetto non trovato.'
          : errorMessage(project.error)}
      </FullPageMessage>
    );
  }
  return <ProjectView detail={project.data} isRefreshing={project.isFetching} />;
}

function ProjectView({
  detail,
  isRefreshing,
}: {
  detail: NonNullable<ReturnType<typeof useProject>['data']>;
  isRefreshing: boolean;
}) {
  const { project, role, tasks } = detail;
  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const members = useMembers(project.workspaceId);
  const updateProject = useUpdateProject(project.id);
  const archive = useArchiveProject(project.id, project.workspaceId);
  const canEdit = hasMinRole(role, 'EDITOR');
  const workspace = workspaces.data?.find((w) => w.id === project.workspaceId);

  const onArchive = () => {
    if (!window.confirm(`Archiviare «${project.name}»? Non sarà più visibile nel workspace.`))
      return;
    archive.mutate(undefined, { onSuccess: () => navigate(`/w/${project.workspaceId}`) });
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <Link
          to={`/w/${project.workspaceId}`}
          className="text-sm text-slate-500 hover:text-indigo-600"
        >
          ← {workspace?.name ?? 'Workspace'}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-full"
            style={{ background: project.color }}
          />
          <div className="min-w-0 flex-1 text-2xl font-semibold">
            <TextCell
              value={project.name}
              label="Nome del progetto"
              disabled={!canEdit}
              className="text-2xl font-semibold"
              onCommit={(name) => updateProject.mutate({ name })}
            />
          </div>
          <span className="text-xs text-slate-400" aria-live="polite">
            {isRefreshing ? 'Aggiornamento…' : ''}
          </span>
          {!canEdit && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {ROLE_LABELS[role]} · sola lettura
            </span>
          )}
          {canEdit && (
            <Button variant="ghost" onClick={onArchive} disabled={archive.isPending}>
              Archivia
            </Button>
          )}
        </div>
        <FormError>
          {(updateProject.error ?? archive.error) &&
            errorMessage(updateProject.error ?? archive.error)}
        </FormError>
      </div>
      <TaskTable
        projectId={project.id}
        tasks={tasks}
        members={members.data ?? []}
        canEdit={canEdit}
      />
      {canEdit && tasks.length > 0 && (
        <p className="text-xs text-slate-400">
          Suggerimento: nel nome di un task, Tab lo rende sottotask del precedente e Maiusc+Tab lo
          riporta al livello superiore. Le modifiche dei colleghi compaiono entro 20 secondi.
        </p>
      )}
    </div>
  );
}
