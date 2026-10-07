import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageMessage } from '../../components/ui';
import { useMe } from './api';

export function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <FullPageMessage>Caricamento…</FullPageMessage>;
  if (me.isError) return <FullPageMessage>Impossibile contattare il server.</FullPageMessage>;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Login/registration pages: logged-in users go straight to the app. */
export function RequireGuest() {
  const me = useMe();
  if (me.isPending) return <FullPageMessage>Caricamento…</FullPageMessage>;
  if (me.data) return <Navigate to="/" replace />;
  return <Outlet />;
}
