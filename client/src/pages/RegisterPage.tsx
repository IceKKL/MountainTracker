import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mountain } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username.trim(), password, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd rejestracji');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow)] sm:p-12">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(196,92,58,0.1)] text-[var(--accent)]">
            <Mountain size={30} />
          </span>
          <h1 className="font-[var(--font-heading)] text-[1.75rem] font-bold text-[var(--text)]">
            Mountain Tracker
          </h1>
          <p className="text-base text-[var(--text-muted)]">Utwórz nowe konto</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            Login
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-3 text-base font-normal text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(196,92,58,0.25)]"
              required
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            Hasło
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-3 text-base font-normal text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(196,92,58,0.25)]"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <span className="text-xs font-normal text-[var(--text-muted)]">
              Minimum 8 znaków
            </span>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            Imię
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-3 text-base font-normal text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(196,92,58,0.25)]"
              required
              autoComplete="name"
            />
          </label>
          {error && (
            <p className="rounded-[8px] bg-[rgba(179,58,58,0.08)] px-3 py-2 text-sm text-[#b33a3a]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-[8px] bg-[var(--accent)] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {loading ? 'Rejestracja…' : 'Utwórz konto'}
          </button>
        </form>

        <p className="mt-10 text-center text-sm text-[var(--text-muted)]">
          Masz już konto?{' '}
          <Link to="/logowanie" className="font-medium text-[var(--accent)] hover:underline">
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  );
}
