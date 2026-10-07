import type { Role, Workspace } from '@davegantt/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button, FormError } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useMe } from '../auth/api';
import { useAddMember, useMembers, useRemoveMember, useUpdateMemberRole } from './members-api';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from './roles';

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';

export function ShareDialog({
  workspace,
  open,
  onClose,
}: {
  workspace: Workspace;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // Native <dialog> gives focus trapping, Esc to close and the backdrop for free.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="share-title"
      className="m-auto w-full max-w-lg rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      {open && <ShareDialogBody workspace={workspace} onClose={onClose} />}
    </dialog>
  );
}

function ShareDialogBody({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const isOwner = workspace.role === 'OWNER';
  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="share-title" className="text-lg font-semibold text-slate-900">
            Condividi «{workspace.name}»
          </h2>
          <p className="text-sm text-slate-500">I membri vedono tutti i progetti del workspace.</p>
        </div>
        <Button variant="ghost" onClick={onClose} aria-label="Chiudi">
          ✕
        </Button>
      </div>
      {isOwner && <AddMemberForm workspaceId={workspace.id} />}
      <MemberList workspace={workspace} />
    </div>
  );
}

function AddMemberForm({ workspaceId }: { workspaceId: string }) {
  const add = useAddMember(workspaceId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EDITOR');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate({ email, role }, { onSuccess: () => setEmail('') });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label htmlFor="member-email" className="text-sm font-medium text-slate-700">
        Aggiungi un collega
      </label>
      <div className="flex gap-2">
        <input
          id="member-email"
          type="email"
          required
          placeholder="email@azienda.it"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            add.reset();
          }}
        />
        <select
          aria-label="Ruolo"
          className={selectClass}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={add.isPending}>
          Aggiungi
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Il collega deve essersi già registrato a daveGantt. {ROLE_LABELS[role]}:{' '}
        {ROLE_DESCRIPTIONS[role].toLowerCase()}.
      </p>
      <FormError>{add.isError && errorMessage(add.error)}</FormError>
    </form>
  );
}

function MemberList({ workspace }: { workspace: Workspace }) {
  const me = useMe();
  const navigate = useNavigate();
  const members = useMembers(workspace.id);
  const updateRole = useUpdateMemberRole(workspace.id);
  const remove = useRemoveMember(workspace.id);
  const isOwner = workspace.role === 'OWNER';

  const onRemove = (userId: string, name: string) => {
    const leaving = userId === me.data?.id;
    const question = leaving
      ? `Vuoi davvero uscire da «${workspace.name}»? Perderai l'accesso ai suoi progetti.`
      : `Rimuovere ${name} dal workspace?`;
    if (!window.confirm(question)) return;
    remove.mutate(userId, { onSuccess: () => leaving && navigate('/', { replace: true }) });
  };

  if (members.isPending) return <p className="text-sm text-slate-500">Caricamento membri…</p>;
  if (members.isError) return <FormError>{errorMessage(members.error)}</FormError>;

  const mutationError = updateRole.error ?? remove.error;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-slate-700">Membri ({members.data.length})</h3>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {members.data.map((m) => {
          const isMe = m.userId === me.data?.id;
          return (
            <li key={m.userId} className="flex items-center gap-3 px-3 py-2">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700"
              >
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {m.name}
                  {isMe && <span className="font-normal text-slate-500"> (tu)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{m.email}</p>
              </div>
              {isOwner ? (
                <select
                  aria-label={`Ruolo di ${m.name}`}
                  className={selectClass}
                  value={m.role}
                  disabled={updateRole.isPending}
                  onChange={(e) =>
                    updateRole.mutate({ userId: m.userId, role: e.target.value as Role })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-slate-500">{ROLE_LABELS[m.role]}</span>
              )}
              {(isOwner || isMe) && (
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  disabled={remove.isPending}
                  onClick={() => onRemove(m.userId, m.name)}
                >
                  {isMe ? 'Esci' : 'Rimuovi'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <FormError>{mutationError && errorMessage(mutationError)}</FormError>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
