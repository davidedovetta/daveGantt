import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Button, FullPageMessage } from '../../components/ui';
import { ProjectList } from '../projects/ProjectList';
import { useWorkspaces } from './api';
import { ShareDialog } from './ShareDialog';

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
  const [sharing, setSharing] = useState(false);
  const workspace = workspaces.data?.find((ws) => ws.id === workspaceId);

  if (workspaces.isPending) return <FullPageMessage>Caricamento…</FullPageMessage>;
  if (!workspace) return <FullPageMessage>Workspace non trovato.</FullPageMessage>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <Button onClick={() => setSharing(true)}>Condividi</Button>
      </div>
      <ProjectList workspace={workspace} />
      <ShareDialog workspace={workspace} open={sharing} onClose={() => setSharing(false)} />
    </div>
  );
}
