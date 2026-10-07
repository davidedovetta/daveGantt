import { hasMinRole, type Workspace } from '@davegantt/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, FormError } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useCreateProject, useProjects } from './api';

export function ProjectList({ workspace }: { workspace: Workspace }) {
  const projects = useProjects(workspace.id);
  const create = useCreateProject(workspace.id);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const canEdit = hasMinRole(workspace.role, 'EDITOR');

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ name }, { onSuccess: (p) => navigate(`/p/${p.id}`) });
  };

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Progetti
      </h2>
      {canEdit && (
        <form onSubmit={onCreate} className="mb-4 flex max-w-md gap-2">
          <input
            aria-label="Nome del nuovo progetto"
            placeholder="Nome del nuovo progetto"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={create.isPending || !name.trim()}>
            Nuovo progetto
          </Button>
        </form>
      )}
      <FormError>{create.isError && errorMessage(create.error)}</FormError>
      {projects.isPending && <p className="text-sm text-slate-500">Caricamento…</p>}
      {projects.isError && <FormError>{errorMessage(projects.error)}</FormError>}
      {projects.data?.length === 0 && (
        <p className="text-sm text-slate-500">
          Nessun progetto.{canEdit ? ' Creane uno con il campo qui sopra.' : ''}
        </p>
      )}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {projects.data?.map((p) => (
          <li key={p.id}>
            <Link
              to={`/p/${p.id}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm hover:border-indigo-300 hover:shadow"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ background: p.color }}
              />
              <span className="truncate">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
