import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, FormError, TextField } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useRegister } from './api';
import { AuthCard } from './AuthCard';

export function RegisterPage() {
  const register = useRegister();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate(
      { name, email, password },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  };

  return (
    <AuthCard title="Crea un account">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          id="name"
          label="Nome"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          label="Password (almeno 8 caratteri)"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError>{register.isError && errorMessage(register.error)}</FormError>
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Creazione in corso…' : 'Crea account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Hai già un account?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Accedi
        </Link>
      </p>
    </AuthCard>
  );
}
