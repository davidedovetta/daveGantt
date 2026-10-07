import { Navigate, useParams } from 'react-router';
import { FullPageMessage } from '../../components/ui';
import { useWorkspaces } from './api';

/** `/` → first workspace of the user. */
export function WorkspaceIndexRedirect() {
  const workspaces = useWorkspaces();
  if (workspaces.isPending) return <FullPageMessage>Caricamento…</FullPageMessage>;
  const first = workspaces.data?.[0];
  if (!first) return <FullPageMessage>Nessun workspace disponibile.</FullPageMessage>;
  return <Navigate to={`/w/${first.id}`} replace />;
}

export function WorkspacePage() {
  const { workspaceId } = useParams();
  const workspaces = useWorkspaces();
  const workspace = workspaces.data?.find((ws) => ws.id === workspaceId);

  if (workspaces.isPending) return <FullPageMessage>Caricamento…</FullPageMessage>;
  if (!workspace) return <FullPageMessage>Workspace non trovato.</FullPageMessage>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">{workspace.name}</h1>
      <p className="mt-2 text-sm text-slate-500">Qui compariranno i progetti del workspace.</p>
    </div>
  );
}
