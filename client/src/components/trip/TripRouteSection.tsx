import { useRef, useState } from 'react';
import { Info, Route, TrendingUp, Upload } from 'lucide-react';
import { getTripGpxData, uploadTripGpx } from '../../api/trips';
import type { TripRef } from '../../api/trips';
import type { GpxData } from '../../types/trip';
import ElevationChart from './ElevationChart';
import TripMap from './TripMap';

interface Props {
  trip: TripRef;
  hasGpx: boolean;
  distanceKm: number | null;
  elevationGainM: number | null;
  gpxData: GpxData | null;
  gpxLoading?: boolean;
  durationEstimated?: boolean;
  onGpxUploaded: (data: GpxData) => void;
}

function RouteVisualSkeleton() {
  return (
    <div className="flex flex-col gap-10 mt-4">
      <div
        className="h-80 w-full animate-pulse rounded-xl bg-stone-200"
        aria-hidden
      />
      <div
        className="h-[220px] w-full animate-pulse rounded-xl bg-stone-200"
        aria-hidden
      />
    </div>
  );
}

export default function TripRouteSection({
  trip,
  hasGpx,
  distanceKm,
  elevationGainM,
  gpxData,
  gpxLoading = false,
  durationEstimated = false,
  onGpxUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [estimatedHint, setEstimatedHint] = useState(durationEstimated);
  const [hoveredPoint, setHoveredPoint] = useState<[number, number] | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setError('Dozwolony format: .gpx');
      return;
    }
    setUploading(true);
    setError('');
    setHoveredPoint(null);
    try {
      const data = await uploadTripGpx(trip, file);
      setEstimatedHint(!!data.duration_estimated);
      onGpxUploaded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd uploadu GPX');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleReload() {
    if (!hasGpx) return;
    try {
      const data = await getTripGpxData(trip);
      onGpxUploaded(data);
    } catch {
      /* ignore */
    }
  }

  const dist = gpxData?.distance_km ?? distanceKm;
  const elev = gpxData?.elevation_gain_m ?? elevationGainM;
  const showHint = estimatedHint || gpxData?.duration_estimated;
  const showRouteSkeleton = gpxLoading || uploading;
  const hasRouteVisuals = gpxData && gpxData.track.length >= 2;

  return (
    <section className="trip-details-section card">
      <div className="section-header">
        <h2>Trasa (GPX)</h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={16} />
          {uploading ? 'Wgrywanie...' : hasGpx ? 'Podmień GPX' : 'Wgraj GPX'}
        </button>
        <input ref={inputRef} type="file" accept=".gpx" hidden onChange={handleUpload} />
      </div>

      {error && <p className="error-msg">{error}</p>}

      {showHint && (
        <p className="route-duration-hint">
          <Info size={14} />
          Czas przejścia wyliczony automatycznie na podstawie dystansu i przewyższenia (brak
          znaczników czasu w GPX).
        </p>
      )}

      {(dist != null || elev != null) && (
        <div className="route-stats">
          {dist != null && (
            <span>
              <Route size={14} />
              {dist.toFixed(2)} km
            </span>
          )}
          {elev != null && (
            <span>
              <TrendingUp size={14} />
              {elev} m przewyższenia
            </span>
          )}
        </div>
      )}

      {showRouteSkeleton ? (
        <RouteVisualSkeleton />
      ) : hasRouteVisuals ? (
        <div className="route-visuals">
          <TripMap track={gpxData.track} hoveredPoint={hoveredPoint} />
          <ElevationChart
            profile={gpxData.profile}
            track={gpxData.track}
            onPointHover={setHoveredPoint}
          />
        </div>
      ) : hasGpx ? (
        <p className="text-muted">
          Nie udało się wczytać trasy.{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleReload}>
            Spróbuj ponownie
          </button>
        </p>
      ) : (
        <p className="text-muted route-placeholder">
          Wgraj plik GPX, aby zobaczyć mapę trasy i profil wysokościowy.
        </p>
      )}
    </section>
  );
}
