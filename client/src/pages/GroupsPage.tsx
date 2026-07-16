import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Plus, Users } from 'lucide-react';
import { createGroup, getGroups, joinGroup } from '../api/groups';
import type { Group } from '../api/groups';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGroups(await getGroups());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania grup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const group = await createGroup(createName.trim());
      setNewInviteCode(group.invite_code);
      setCopied(false);
      setCreateName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd tworzenia grupy');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await joinGroup(joinCode.trim());
      setJoinCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd dołączania do grupy');
    } finally {
      setActionLoading(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const inputClass =
    'w-full rounded-[8px] border border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(196,92,58,0.25)]';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="flex items-center gap-2">
            <Users size={26} className="text-[var(--accent)]" />
            Grupy
          </h1>
          <p className="text-muted">Twórz grupy i udostępniaj wycieczki znajomym</p>
        </div>
      </div>

      <div className="mb-10 grid gap-6 md:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]"
        >
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
            <Plus size={18} className="text-[var(--accent)]" />
            Utwórz grupę
          </h2>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Otrzymasz kod zaproszenia dla znajomych.
          </p>
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Nazwa grupy"
            className={`${inputClass} mb-4`}
          />
          <button
            type="submit"
            disabled={actionLoading}
            className="w-full rounded-[8px] bg-[var(--accent)] px-4 py-3 font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            Utwórz grupę
          </button>
          {newInviteCode && (
            <div className="mt-5 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-4">
              <p className="mb-2 text-sm text-[var(--text-muted)]">Kod zaproszenia:</p>
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-lg font-semibold text-[var(--accent)]">
                  {newInviteCode}
                </code>
                <button
                  type="button"
                  onClick={() => copyCode(newInviteCode)}
                  className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-white hover:text-[var(--text)]"
                  title="Kopiuj kod"
                >
                  {copied ? <Check size={16} className="text-[var(--green)]" /> : <Copy size={16} />}
                  {copied ? 'Skopiowano' : 'Kopiuj'}
                </button>
              </div>
            </div>
          )}
        </form>

        <form
          onSubmit={handleJoin}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]"
        >
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
            <Users size={18} className="text-[var(--green)]" />
            Dołącz do grupy
          </h2>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Wpisz kod otrzymany od znajomego.
          </p>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="np. gory-2026-abc"
            className={`${inputClass} mb-4`}
          />
          <button
            type="submit"
            disabled={actionLoading}
            className="w-full rounded-[8px] border border-[var(--accent)] px-4 py-3 font-medium text-[var(--accent)] transition-colors hover:bg-[rgba(196,92,58,0.08)] disabled:opacity-50"
          >
            Dołącz
          </button>
        </form>
      </div>

      {error && (
        <p className="mb-6 rounded-[8px] bg-[rgba(179,58,58,0.08)] px-4 py-2.5 text-sm text-[#b33a3a]">
          {error}
        </p>
      )}

      <section>
        <div className="section-header">
          <h2>Twoje grupy</h2>
        </div>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-20 animate-pulse rounded-[var(--radius)] bg-[var(--border)]" />
            <div className="h-20 animate-pulse rounded-[var(--radius)] bg-[var(--border)]" />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--text-muted)]">
            Nie należysz jeszcze do żadnej grupy.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/grupy/${g.id}`}
                  className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-6 py-5 shadow-[var(--shadow)] transition-colors hover:border-[var(--accent)]"
                >
                  <span className="flex items-center gap-2 font-semibold text-[var(--text)]">
                    <Users size={18} className="text-[var(--stone)]" />
                    {g.name}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {g.member_count ?? '?'} członków
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
