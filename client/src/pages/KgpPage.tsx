import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Crown, Mountain } from 'lucide-react';
import { getKgpTracker, type KgpTrackerData, type KgpTrackerPeak } from '../api/kgp';
import KgpProgressBar from '../components/KgpProgressBar';
import { formatDisplayDate } from '../utils/date';
import { tripPath } from '../utils/slugify';

function PeakCard({ peak, className = '' }: { peak: KgpTrackerPeak; className?: string }) {
  const conquered = peak.conquer_count > 0;

  return (
    <article
      className={`card kgp-peak-card${conquered ? ' kgp-peak-conquered' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="kgp-peak-header">
        {conquered && (
          <span className="kgp-conquered-badge" title="Zdobyty">
            <Check size={14} />
          </span>
        )}
        <h3>
          {peak.kgp_url ? (
            <a
              href={peak.kgp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text)] hover:text-[var(--accent)] hover:underline"
            >
              {peak.name}
            </a>
          ) : (
            peak.name
          )}
          {peak.conquer_order != null && (
            <span className="kgp-conquer-order" title="Kolejność i data pierwszego wejścia">
              <span className="kgp-conquer-order-num">#{peak.conquer_order}</span>
              {peak.first_conquered_at && (
                <span className="kgp-conquer-date">
                  {formatDisplayDate(peak.first_conquered_at)}
                </span>
              )}
            </span>
          )}
        </h3>
        <span className="kgp-elevation">{peak.elevation_m} m n.p.m.</span>
      </div>
      <p className="text-muted kgp-range-label">{peak.mountain_range}</p>
      {conquered ? (
        <p className="kgp-conquer-info">
          Zdobyto: {peak.conquer_count} {peak.conquer_count === 1 ? 'raz' : 'razy'} (
          {peak.trips.map((trip, i) => (
            <span key={trip.id}>
              {i > 0 && ', '}
              <Link to={tripPath(trip.id, trip.name)}>{trip.name}</Link>
            </span>
          ))}
          )
        </p>
      ) : (
        <p className="text-muted kgp-not-conquered">
          <Mountain size={14} />
          Jeszcze niezdobyty
        </p>
      )}
    </article>
  );
}

export default function KgpPage() {
  const [data, setData] = useState<KgpTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getKgpTracker()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Błąd ładowania'))
      .finally(() => setLoading(false));
  }, []);

  const { crownPeak, otherPeaks } = useMemo(() => {
    if (!data) return { crownPeak: null, otherPeaks: [] as KgpTrackerPeak[] };
    const sorted = [...data.peaks].sort((a, b) => b.elevation_m - a.elevation_m);
    const crown = sorted.find((p) => p.name === 'Rysy') ?? sorted[0];
    return {
      crownPeak: crown,
      otherPeaks: sorted.filter((p) => p.id !== crown.id),
    };
  }, [data]);

  if (loading) {
    return (
      <div className="page">
        <h1>KGP Tracker</h1>
        <p className="text-muted">Ładowanie...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>KGP Tracker</h1>
        <p className="error-msg">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="page kgp-page">
      <h1>KGP Tracker</h1>
      <p className="text-muted kgp-subtitle">Korona Gór Polskich — {data.progress.total} szczytów</p>

      <div className="kgp-progress-header">
        <span className="kgp-progress-label">
          Postęp: {data.progress.conquered}/{data.progress.total}
        </span>
        <KgpProgressBar
          conquered={data.progress.conquered}
          total={data.progress.total}
          size="lg"
          showLabel={false}
        />
      </div>

      {crownPeak && (
        <div className="kgp-crown-peak">
          <div className="kgp-crown-wrap">
            <span className="kgp-crown-icon" aria-hidden="true" title="Najwyższy szczyt KGP">
              <Crown size={24} strokeWidth={1.75} />
            </span>
            <PeakCard peak={crownPeak} className="kgp-peak-crown" />
          </div>
        </div>
      )}

      <div className="kgp-peaks-grid">
        {otherPeaks.map((peak) => (
          <PeakCard key={peak.id} peak={peak} />
        ))}
      </div>
    </div>
  );
}
