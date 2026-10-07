import { useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useLogout, useMe } from '../auth/api';
import { useCreateWorkspace, useWorkspaces } from './api';

const ROLE_LABELS = { OWNER: 'Proprietario', EDITOR: 'Editor', VIEWER: 'Lettore' } as const;

export function AppLayout() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-white text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        <div className="px-4 py-4 text-lg font-semibold text-indigo-600">daveGantt</div>
        <WorkspaceNav />
        <div className="mt-auto border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium">{me.data?.name}</p>
          <p className="mb-2 truncate text-xs text-slate-500">{me.data?.email}</p>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
          >
            Esci
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

function WorkspaceNav() {
  const workspaces = useWorkspaces();
  const create = useCreateWorkspace();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name },
      {
        onSuccess: (ws) => {
          setName('');
          setCreating(false);
          navigate(`/w/${ws.id}`);
        },
      },
    );
  };

  return (
    <nav className="flex flex-col gap-1 px-2" aria-label="Workspace">
      <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Workspace
      </p>
      {workspaces.isPending && <p className="px-2 text-sm text-slate-500">Caricamento…</p>}
      {workspaces.isError && (
        <p className="px-2 text-sm text-red-600">{errorMessage(workspaces.error)}</p>
      )}
      {workspaces.data?.map((ws) => (
        <NavLink
          key={ws.id}
          to={`/w/${ws.id}`}
          className={({ isActive }) =>
            `flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
              isActive ? 'bg-indigo-100 text-indigo-800' : 'text-slate-700 hover:bg-slate-100'
            }`
          }
        >
          <span className="truncate">{ws.name}</span>
          <span className="ml-2 shrink-0 text-xs text-slate-500">{ROLE_LABELS[ws.role]}</span>
        </NavLink>
      ))}
      {creating ? (
        <form onSubmit={onCreate} className="mt-1 flex flex-col gap-1 px-2">
          <input
            autoFocus
            aria-label="Nome del nuovo workspace"
            placeholder="Nome workspace"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
          />
          {create.isError && <p className="text-xs text-red-600">{errorMessage(create.error)}</p>}
          <div className="flex gap-1">
            <Button
              type="submit"
              className="flex-1 py-1"
              disabled={create.isPending || !name.trim()}
            >
              Crea
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="py-1"
              onClick={() => setCreating(false)}
            >
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-1 rounded-md px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100"
        >
          + Nuovo workspace
        </button>
      )}
    </nav>
  );
}
