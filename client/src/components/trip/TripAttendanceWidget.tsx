import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getTripParticipants, respondTrip } from '../../api/trips';
import type { TripParticipantsResponse } from '../../types/trip';

interface Props {
  tripId: number;
  tripName: string;
}

export default function TripAttendanceWidget({ tripId, tripName }: Props) {
  const [data, setData] = useState<TripParticipantsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setData(await getTripParticipants({ id: tripId, name: tripName }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania uczestników');
      if (!silent) setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tripId, tripName]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRespond(status: 'joined' | 'declined') {
    setResponding(true);
    setError('');
    try {
      await respondTrip({ id: tripId, name: tripName }, status);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu deklaracji');
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
      </div>
    );
  }

  if (!data) return null;

  const joined = data.members.filter((m) => m.status === 'joined');
  const declined = data.members.filter((m) => m.status === 'declined');

  return (
    <div className="mt-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text)]">
        <Users size={14} className="text-[var(--accent)]" />
        Obecność: {data.joined_count}/{data.total}
      </div>

      {joined.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Dołączyli
          </p>
          <ul className="space-y-0.5 text-sm text-[var(--text)]">
            {joined.map((m) => (
              <li key={m.id}>
                {m.name} <span className="text-[var(--text-muted)]">@{m.username}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {declined.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Odpuścili
          </p>
          <ul className="space-y-0.5 text-sm text-[var(--text-muted)]">
            {declined.map((m) => (
              <li key={m.id}>
                {m.name} <span>@{m.username}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={responding}
          onClick={() => handleRespond('joined')}
          className="rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          Dołączam
        </button>
        <button
          type="button"
          disabled={responding}
          onClick={() => handleRespond('declined')}
          className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-white hover:text-[var(--text)] disabled:opacity-50"
        >
          Odpuszczam
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-[#b33a3a]">{error}</p>}
    </div>
  );
}
