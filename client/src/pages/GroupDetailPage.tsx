import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUp, Check, Clock, Copy, Route, Share2, Trash2, Users, X } from 'lucide-react';
import { getGroup, getGroupStats, leaveGroup, removeGroupMember, shareTrip, unshareTrip } from '../api/groups';
import { getTrips, parseGpxProfile } from '../api/trips';
import type { GroupActivityStats, GroupDetail, GroupMember, GroupTripSummary } from '../api/groups';
import type { Trip } from '../types/trip';
import TripAttendanceWidget from '../components/trip/TripAttendanceWidget';
import TripCardMap from '../components/trip/TripCardMap';
import { useAuth } from '../context/AuthContext';
import { tripPath } from '../utils/slugify';

function formatDuration(min: number): string {
  if (!min) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export default function GroupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const groupId = Number(id);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [stats, setStats] = useState<GroupActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [ownTrips, setOwnTrips] = useState<Trip[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unshareTarget, setUnshareTarget] = useState<GroupTripSummary | null>(null);
  const [unshareLoading, setUnshareLoading] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [kickTarget, setKickTarget] = useState<GroupMember | null>(null);
  const [kickLoading, setKickLoading] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(groupId) || groupId <= 0) return;
    setLoading(true);
    setError('');
    try {
      const [groupData, statsData] = await Promise.all([
        getGroup(groupId),
        getGroupStats(groupId),
      ]);
      setGroup(groupData);
      setStats(statsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania grupy');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openShareModal() {
    setShareOpen(true);
    try {
      const trips = await getTrips();
      setOwnTrips(trips.filter((t) => t.is_owner !== false));
    } catch {
      setOwnTrips([]);
    }
  }

  async function handleShare(tripId: number) {
    setShareLoading(true);
    try {
      await shareTrip(groupId, tripId);
      setShareOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd udostępniania');
    } finally {
      setShareLoading(false);
    }
  }

  async function handleUnshare() {
    if (!unshareTarget) return;
    setUnshareLoading(true);
    setError('');
    try {
      await unshareTrip(groupId, unshareTarget.id);
      setUnshareTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd usuwania z grupy');
    } finally {
      setUnshareLoading(false);
    }
  }

  async function handleLeave() {
    setLeaveLoading(true);
    setError('');
    try {
      await leaveGroup(groupId);
      navigate('/grupy');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd opuszczania grupy');
      setLeaveConfirmOpen(false);
    } finally {
      setLeaveLoading(false);
    }
  }

  async function handleKick() {
    if (!kickTarget) return;
    setKickLoading(true);
    setError('');
    try {
      await removeGroupMember(groupId, kickTarget.id);
      setKickTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd usuwania członka');
    } finally {
      setKickLoading(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function renderGroupTripCard(t: GroupTripSummary) {
    const gpxTrack = t.gpx_filename ? parseGpxProfile(t.gpx_profile_json) : null;
    const showMap =
      (gpxTrack && gpxTrack.length >= 2) || (t.lat != null && t.lon != null);

    return (
      <li key={t.id} className="card trip-card">
        <div className="trip-card-top">
          <div className="trip-card-header">
            <h3>
              <Link to={tripPath(t.id, t.name)} className="trip-card-link">
                {t.name}
              </Link>
            </h3>
            <span className={`badge badge-${t.status}`}>
              {t.status === 'planowana' ? 'Planowana' : 'Zrealizowana'}
            </span>
          </div>
          {t.is_owner && (
            <div className="trip-card-actions">
              <button
                type="button"
                className="btn-icon danger"
                onClick={() => setUnshareTarget(t)}
                aria-label="Usuń z grupy"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="trip-card-main">
          <div className="trip-card-body">
            <p className="text-muted text-sm">
              {t.peak_name} · {t.date_start} · @{t.owner_username}
            </p>
            {t.status === 'planowana' && (
              <TripAttendanceWidget tripId={t.id} tripName={t.name} />
            )}
          </div>
          {showMap && (
            <Link to={tripPath(t.id, t.name)} className="trip-card-map-link" tabIndex={-1}>
              <TripCardMap lat={t.lat} lon={t.lon} track={gpxTrack} />
            </Link>
          )}
        </div>
      </li>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="mb-6 h-5 w-32 animate-pulse rounded bg-[var(--border)]" />
        <div className="mb-6 h-9 w-56 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-40 animate-pulse rounded-[var(--radius)] bg-[var(--border)]" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="page">
        <p className="rounded-[8px] bg-[rgba(179,58,58,0.08)] px-4 py-2.5 text-sm text-[#b33a3a]">
          {error || 'Grupa nie znaleziona'}
        </p>
        <Link to="/grupy" className="back-link mt-4 inline-flex">
          <ArrowLeft size={16} />
          Wróć do listy grup
        </Link>
      </div>
    );
  }

  const isCreator = user != null && group.created_by === user.id;

  return (
    <div className="page">
      <Link to="/grupy" className="back-link mb-4 inline-flex">
        <ArrowLeft size={16} />
        Wszystkie grupy
      </Link>

      <header className="mb-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h1 className="flex items-center gap-2">
            <Users size={26} className="text-[var(--accent)]" />
            {group.name}
          </h1>
          <button
            type="button"
            onClick={() => setLeaveConfirmOpen(true)}
            className="shrink-0 rounded-[8px] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[#b33a3a] hover:bg-[rgba(179,58,58,0.06)] hover:text-[#b33a3a]"
          >
            Opuść
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">Kod zaproszenia:</span>
          <code className="font-mono text-base font-semibold text-[var(--accent)]">
            {group.invite_code}
          </code>
          <button
            type="button"
            onClick={() => copyCode(group.invite_code)}
            className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-white hover:text-[var(--text)]"
            title="Kopiuj kod"
          >
            {copied ? <Check size={16} className="text-[var(--green)]" /> : <Copy size={16} />}
            {copied ? 'Skopiowano' : 'Kopiuj'}
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-6 rounded-[8px] bg-[rgba(179,58,58,0.08)] px-4 py-2.5 text-sm text-[#b33a3a]">
          {error}
        </p>
      )}

      {stats && (
        <section className="mb-10">
          <div className="section-header">
            <h2>Statystyki grupy</h2>
          </div>
          <div className="home-stats-grid">
            <div className="card home-stat-card">
              <Clock size={22} className="home-stat-icon" />
              <h2>Czas wypraw</h2>
              <p className="home-stat-sub">
                W tym miesiącu: <strong>{formatDuration(stats.month.duration_min)}</strong>
              </p>
              <p className="home-stat-sub">
                W tym roku: <strong>{formatDuration(stats.year.duration_min)}</strong>
              </p>
            </div>
            <div className="card home-stat-card">
              <ArrowUp size={22} className="home-stat-icon" />
              <h2>Przewyższenia</h2>
              <p className="home-stat-sub">
                W tym miesiącu:{' '}
                <strong>{stats.month.elevation_gain_m.toLocaleString('pl-PL')} m</strong>
              </p>
              <p className="home-stat-sub">
                W tym roku:{' '}
                <strong>{stats.year.elevation_gain_m.toLocaleString('pl-PL')} m</strong>
              </p>
            </div>
            <div className="card home-stat-card">
              <Route size={22} className="home-stat-icon" />
              <h2>Dystans</h2>
              <p className="home-stat-sub">
                W tym miesiącu:{' '}
                <strong>{stats.month.distance_km.toLocaleString('pl-PL')} km</strong>
              </p>
              <p className="home-stat-sub">
                W tym roku: <strong>{stats.year.distance_km.toLocaleString('pl-PL')} km</strong>
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mb-10">
        <div className="section-header">
          <h2>
            <Users size={18} className="text-[var(--stone)]" />
            Członkowie ({group.members.length})
          </h2>
        </div>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          {group.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-6 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(196,92,58,0.1)] text-sm font-semibold uppercase text-[var(--accent)]">
                {m.name.slice(0, 1)}
              </span>
              <span className="font-medium text-[var(--text)]">{m.name}</span>
              <span className="text-sm text-[var(--text-muted)]">@{m.username}</span>
              {isCreator && m.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => setKickTarget(m)}
                  className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[rgba(179,58,58,0.08)] hover:text-[#b33a3a]"
                  aria-label={`Usuń ${m.name} z grupy`}
                >
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="section-header">
          <h2>Wspólne wycieczki</h2>
          <button
            type="button"
            onClick={openShareModal}
            className="btn btn-primary btn-sm"
          >
            <Share2 size={16} />
            Udostępnij wycieczkę
          </button>
        </div>

        {group.trips.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--text-muted)]">
            Brak wspólnych wycieczek.
          </div>
        ) : (
          <ul className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(480px,1fr))]">
            {group.trips.map(renderGroupTripCard)}
          </ul>
        )}
      </section>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,42,38,0.45)] px-4">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text)]">
              Wybierz wycieczkę do udostępnienia
            </h3>
            {ownTrips.length === 0 ? (
              <p className="mb-4 text-sm text-[var(--text-muted)]">Brak własnych wycieczek.</p>
            ) : (
              <ul className="mb-4 flex max-h-72 flex-col gap-1 overflow-y-auto">
                {ownTrips.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={shareLoading}
                      onClick={() => handleShare(t.id)}
                      className="w-full rounded-[8px] px-4 py-3 text-left transition-colors hover:bg-white disabled:opacity-50"
                    >
                      <span className="font-medium text-[var(--text)]">{t.name}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{t.peak_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="btn"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {unshareTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,42,38,0.45)] px-4">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]">
            <h3 className="mb-2 text-lg font-semibold text-[var(--text)]">Usuń z grupy</h3>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Czy chcesz usunąć wycieczkę <strong className="text-[var(--text)]">{unshareTarget.name}</strong> z
              listy wspólnych wycieczek? Sama wycieczka pozostanie w Twoim koncie.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={unshareLoading}
                onClick={() => setUnshareTarget(null)}
                className="btn"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={unshareLoading}
                onClick={handleUnshare}
                className="rounded-[8px] bg-[#b33a3a] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#9a3232] disabled:opacity-50"
              >
                Usuń z grupy
              </button>
            </div>
          </div>
        </div>
      )}

      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,42,38,0.45)] px-4">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]">
            <h3 className="mb-2 text-lg font-semibold text-[var(--text)]">Opuść grupę</h3>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Czy na pewno chcesz opuścić grupę{' '}
              <strong className="text-[var(--text)]">{group.name}</strong>? Stracisz dostęp do wspólnych
              wycieczek i statystyk tej grupy.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={leaveLoading}
                onClick={() => setLeaveConfirmOpen(false)}
                className="btn"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={leaveLoading}
                onClick={handleLeave}
                className="rounded-[8px] bg-[#b33a3a] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#9a3232] disabled:opacity-50"
              >
                Opuść grupę
              </button>
            </div>
          </div>
        </div>
      )}

      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,42,38,0.45)] px-4">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]">
            <h3 className="mb-2 text-lg font-semibold text-[var(--text)]">Usuń członka</h3>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Czy na pewno chcesz usunąć użytkownika{' '}
              <strong className="text-[var(--text)]">{kickTarget.name}</strong> (@{kickTarget.username}) z
              grupy?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={kickLoading}
                onClick={() => setKickTarget(null)}
                className="btn"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={kickLoading}
                onClick={handleKick}
                className="rounded-[8px] bg-[#b33a3a] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#9a3232] disabled:opacity-50"
              >
                Usuń z grupy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
