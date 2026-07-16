import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Users } from 'lucide-react';
import { getGroup, getGroups, shareTrip, type Group } from '../../api/groups';

interface Props {
  tripId: number;
  onClose: () => void;
  onShared: () => void;
}

type GroupOption = Group & { alreadyShared: boolean };

export default function ShareTripToGroupModal({ tripId, onClose, onShared }: Props) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getGroups();
        const withStatus = await Promise.all(
          list.map(async (g) => {
            const detail = await getGroup(g.id);
            return {
              ...g,
              alreadyShared: detail.trips.some((t) => t.id === tripId),
            };
          })
        );
        if (!cancelled) setGroups(withStatus);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Błąd ładowania grup');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  async function handleShare(groupId: number) {
    setSharingId(groupId);
    setError('');
    try {
      await shareTrip(groupId, tripId);
      onShared();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd udostępniania');
    } finally {
      setSharingId(null);
    }
  }

  const available = groups.filter((g) => !g.alreadyShared);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,42,38,0.45)] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
          <Share2 size={20} className="text-[var(--accent)]" />
          Udostępnij do grupy
        </h3>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Wybierz grupę — członkowie zobaczą wycieczkę i wspólną listę pakowania.
        </p>

        {error && (
          <p className="mb-4 rounded-[8px] bg-[rgba(179,58,58,0.08)] px-3 py-2 text-sm text-[#b33a3a]">
            {error}
          </p>
        )}

        {loading ? (
          <div className="mb-4 space-y-2">
            <div className="h-11 animate-pulse rounded-[8px] bg-stone-200" />
            <div className="h-11 animate-pulse rounded-[8px] bg-stone-200" />
          </div>
        ) : groups.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Nie należysz do żadnej grupy.{' '}
            <Link to="/grupy" className="text-[var(--accent)] underline-offset-2 hover:underline">
              Utwórz lub dołącz
            </Link>
          </p>
        ) : available.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Wycieczka jest już udostępniona we wszystkich Twoich grupach.
          </p>
        ) : (
          <ul className="mb-4 flex max-h-64 flex-col gap-1 overflow-y-auto">
            {available.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  disabled={sharingId !== null}
                  onClick={() => handleShare(g.id)}
                  className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors hover:bg-white disabled:opacity-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(196,92,58,0.1)] text-[var(--accent)]">
                    <Users size={16} />
                  </span>
                  <span>
                    <span className="block font-medium text-[var(--text)]">{g.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {g.member_count} {g.member_count === 1 ? 'członek' : 'członków'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}
