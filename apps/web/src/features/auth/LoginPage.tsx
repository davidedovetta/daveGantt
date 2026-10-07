import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button, FormError, TextField } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useLogin } from './api';
import { AuthCard } from './AuthCard';

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) });
  };

  return (
    <AuthCard title="Accedi">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError>{login.isError && errorMessage(login.error)}</FormError>
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Accesso in corso…' : 'Accedi'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Non hai un account?{' '}
        <Link to="/register" className="font-medium text-indigo-600 hover:underline">
          Registrati
        </Link>
      </p>
    </AuthCard>
  );
}
