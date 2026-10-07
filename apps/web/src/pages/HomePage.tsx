import { healthResponseSchema } from '@davegantt/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getJson } from '../lib/api';

export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => getJson('/health', healthResponseSchema),
  });

  let status: { label: string; className: string };
  if (health.isPending) {
    status = { label: 'Verifica in corso…', className: 'bg-slate-100 text-slate-600' };
  } else if (health.error instanceof ApiError && health.error.status === 503) {
    status = { label: 'Database non raggiungibile', className: 'bg-amber-100 text-amber-700' };
  } else if (health.isError) {
    status = { label: 'API non raggiungibile', className: 'bg-red-100 text-red-700' };
  } else {
    status = { label: 'API e database operativi', className: 'bg-emerald-100 text-emerald-700' };
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold text-slate-900">daveGantt</h1>
      <p className="text-slate-600">Pianificazione di progetto con diagrammi di Gantt.</p>
      <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.className}`}>
        {status.label}
      </span>
    </main>
  );
}
