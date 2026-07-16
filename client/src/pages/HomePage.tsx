import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUp,
  Calendar,
  Clock,
  CloudSun,
  MapPin,
  Mountain,
  Plus,
  Route,
  Users,
} from 'lucide-react';
import { getDashboard } from '../api/dashboard';
import { formatWeatherForDate, parseGpxProfile } from '../api/trips';
import type { DashboardData } from '../api/dashboard';
import KgpProgressBar from '../components/KgpProgressBar';
import TripCardMap from '../components/trip/TripCardMap';
import { tripPath } from '../utils/slugify';
import { formatDisplayDate } from '../utils/date';

function formatDuration(min: number | null | undefined): string {
  if (!min) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatUnknownDateTripsMessage(count: number): string {
  if (count === 1) return 'Masz 1 zaplanowaną wycieczkę z nieznaną datą.';
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `Masz ${count} zaplanowane wycieczki z nieznaną datą.`;
  }
  return `Masz ${count} zaplanowanych wycieczek z nieznaną datą.`;
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Błąd ładowania'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <h1>Strona główna</h1>
        <p className="text-muted">Ładowanie...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Strona główna</h1>
        <p className="error-msg">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const {
    kgp_progress,
    activity_stats,
    next_trip,
    next_trip_group,
    next_trip_weather,
    next_trip_packing,
    planned_unknown_date_count,
    last_completed_trip,
    last_trip_companions,
  } = data;

  const weatherSummary =
    next_trip && next_trip_weather
      ? formatWeatherForDate(next_trip_weather, next_trip.date_start)
      : null;

  const packingPct =
    next_trip_packing && next_trip_packing.total > 0
      ? Math.round((next_trip_packing.packed / next_trip_packing.total) * 100)
      : null;

  const lastDuration = last_completed_trip?.actual_duration_min
    ? formatDuration(last_completed_trip.actual_duration_min)
    : null;

  const lastGpxTrack = last_completed_trip?.gpx_filename
    ? parseGpxProfile(last_completed_trip.gpx_profile_json)
    : null;
  const showLastMap =
    (lastGpxTrack && lastGpxTrack.length >= 2) ||
    (last_completed_trip?.lat != null && last_completed_trip?.lon != null);

  return (
    <div className="page home">
      <h1>Strona główna</h1>

      <div className="home-stats-grid">
        <section className="card home-stat-card">
          <Clock size={22} className="home-stat-icon" />
          <h2>Czas wypraw</h2>
          <p className="home-stat-sub">
            W tym miesiącu: <strong>{formatDuration(activity_stats.month.duration_min)}</strong>
          </p>
          <p className="home-stat-sub">
            W tym roku: <strong>{formatDuration(activity_stats.year.duration_min)}</strong>
          </p>
        </section>

        <section className="card home-stat-card">
          <ArrowUp size={22} className="home-stat-icon" />
          <h2>Przewyższenia</h2>
          <p className="home-stat-sub">
            W tym miesiącu: <strong>{activity_stats.month.elevation_gain_m.toLocaleString('pl-PL')} m</strong>
          </p>
          <p className="home-stat-sub">
            W tym roku: <strong>{activity_stats.year.elevation_gain_m.toLocaleString('pl-PL')} m</strong>
          </p>
        </section>

        <section className="card home-stat-card">
          <Route size={22} className="home-stat-icon" />
          <h2>Dystans</h2>
          <p className="home-stat-sub">
            W tym miesiącu: <strong>{activity_stats.month.distance_km.toLocaleString('pl-PL')} km</strong>
          </p>
          <p className="home-stat-sub">
            W tym roku: <strong>{activity_stats.year.distance_km.toLocaleString('pl-PL')} km</strong>
          </p>
        </section>

        <section className="card home-stat-card home-kgp-card">
          <Mountain size={22} className="home-stat-icon" />
          <h2>Postęp KGP</h2>
          <KgpProgressBar
            conquered={kgp_progress.conquered}
            total={kgp_progress.total}
            size="sm"
          />
          <Link to="/kgp" className="home-link">
            Przejdź do trackera KGP
          </Link>
        </section>
      </div>

      <div className="home-panels">
        <section className="card home-panel">
          <h2>Najbliższa zaplanowana wycieczka</h2>
          {next_trip ? (
            <div className="home-panel-widget">
              <h3>
                <Link to={tripPath(next_trip.id, next_trip.name)}>{next_trip.name}</Link>
              </h3>
              <p className="text-muted">
                <Mountain size={14} />
                {next_trip.peak_name}
              </p>
              <p className="text-muted">
                <Calendar size={14} />
                {formatDisplayDate(next_trip.date_start)}
              </p>
              {next_trip_group && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-[8px] bg-[rgba(196,92,58,0.08)] px-3 py-1.5 text-sm text-[var(--text-muted)]">
                  <Users size={14} className="shrink-0 text-[var(--accent)]" />
                  <span>
                    <span className="font-medium text-[var(--text)]">{next_trip_group.name}</span>
                    {' · '}
                    {next_trip_group.member_count}{' '}
                    {next_trip_group.member_count === 1 ? 'członek' : 'członków'}
                  </span>
                </div>
              )}
              {next_trip_packing && (
                <p className="home-packing">
                  Spakowano: {next_trip_packing.packed}/{next_trip_packing.total} przedmiotów
                  {packingPct != null && ` (${packingPct}%)`}
                </p>
              )}
              {weatherSummary ? (
                <p className="forecast-summary">
                  <CloudSun size={14} />
                  Prognoza: {weatherSummary}
                </p>
              ) : next_trip.lat == null ? (
                <p className="text-muted">Brak współrzędnych — nie można pobrać prognozy.</p>
              ) : (
                <p className="text-muted">Prognoza niedostępna dla tej daty.</p>
              )}
            </div>
          ) : (
            <div className="home-empty-cta">
              <p>Brak zaplanowanych wycieczek w najbliższej przyszłości.</p>
              <Link to="/wycieczki?new=1" className="btn btn-primary">
                <Plus size={18} />
                Zaplanuj kolejną wyprawę
              </Link>
              {planned_unknown_date_count > 0 && (
                <Link to="/wycieczki?undated=1" className="home-unknown-date-note">
                  {formatUnknownDateTripsMessage(planned_unknown_date_count)}
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="card home-panel">
          <h2>Ostatnia aktywność</h2>
          {last_completed_trip ? (
            <div className="home-panel-widget">
              <div className="trip-card-main">
                <div className="trip-card-body">
                  <h3>
                    <Link to={tripPath(last_completed_trip.id, last_completed_trip.name)}>
                      {last_completed_trip.name}
                    </Link>
                  </h3>
                  <p className="text-muted">
                    <Calendar size={14} />
                    {formatDisplayDate(last_completed_trip.date_start)}
                  </p>
                  {last_trip_companions.length > 0 && (
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-muted)]">
                      <Users size={14} className="shrink-0 text-[var(--accent)]" />
                      {last_trip_companions.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && ', '}
                          {c.name}
                          <span className="text-[var(--text-muted)]"> (@{c.username})</span>
                        </span>
                      ))}
                    </p>
                  )}
                  <div className="home-activity-stats">
                    {lastDuration && (
                      <span>
                        <Clock size={14} />
                        {lastDuration}
                      </span>
                    )}
                    {last_completed_trip.route_distance_km != null && (
                      <span>
                        <Route size={14} />
                        {last_completed_trip.route_distance_km.toLocaleString('pl-PL')} km
                      </span>
                    )}
                    {last_completed_trip.route_elevation_gain_m != null && (
                      <span>
                        <ArrowUp size={14} />
                        {last_completed_trip.route_elevation_gain_m.toLocaleString('pl-PL')} m
                      </span>
                    )}
                  </div>
                  <Link
                    to={tripPath(last_completed_trip.id, last_completed_trip.name)}
                    className="btn btn-ghost btn-sm home-details-btn"
                  >
                    <MapPin size={14} />
                    Szczegóły wycieczki
                  </Link>
                </div>
                {showLastMap && (
                  <Link
                    to={tripPath(last_completed_trip.id, last_completed_trip.name)}
                    className="trip-card-map-link"
                    tabIndex={-1}
                  >
                    <TripCardMap
                      lat={last_completed_trip.lat}
                      lon={last_completed_trip.lon}
                      track={lastGpxTrack}
                    />
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted">Brak zrealizowanych wycieczek.</p>
          )}
        </section>
      </div>
    </div>
  );
}
