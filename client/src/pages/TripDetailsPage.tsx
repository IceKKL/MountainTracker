import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  CloudSun,
  MapPin,
  Mountain,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';
import DeleteTripModal from '../components/DeleteTripModal';
import ShareTripToGroupModal from '../components/trip/ShareTripToGroupModal';
import TripEditModal from '../components/trip/TripEditModal';
import TripGallery from '../components/trip/TripGallery';
import TripLogisticsSection from '../components/trip/TripLogisticsSection';
import TripPackingSection from '../components/trip/TripPackingSection';
import TripSharedPackingSection from '../components/trip/TripSharedPackingSection';
import TripRatingsSection from '../components/trip/TripRatingsSection';
import TripRouteSection from '../components/trip/TripRouteSection';
import {
  deleteTrip,
  fetchTripForecast,
  formatWeatherForDate,
  getTrip,
  getTripGpxData,
  parseStoredWeather,
  updateTrip,
  type FitUploadResult,
} from '../api/trips';
import type { GpxData, TripDetail, TripInput, TripPhoto } from '../types/trip';
import { formatDisplayDateRange } from '../utils/date';
import { parseTripIdFromSlug, tripPath } from '../utils/slugify';

function formatDuration(min: number | null): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export default function TripDetailsPage() {
  const { idSlug } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [gpxData, setGpxData] = useState<GpxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [error, setError] = useState('');
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [logisticsKey, setLogisticsKey] = useState(0);

  const handlePackingChange = useCallback(() => {
    setLogisticsKey((k) => k + 1);
  }, []);

  const handleFoodWeightChange = useCallback((foodWeightG: number) => {
    setTrip((prev) =>
      prev && prev.food_weight_g !== foodWeightG ? { ...prev, food_weight_g: foodWeightG } : prev
    );
  }, []);

  const logisticsTripSnapshot = trip
    ? {
        name: trip.name,
        peak_name: trip.peak_name,
        date_start: trip.date_start,
        date_end: trip.date_end,
        status: trip.status,
        notes: trip.notes,
        lat: trip.lat,
        lon: trip.lon,
        estimated_duration_min: trip.estimated_duration_min,
        actual_duration_min: trip.actual_duration_min,
        water_start_ml: trip.water_start_ml,
        food_weight_g: trip.food_weight_g,
      }
    : null;

  const load = useCallback(async () => {
    if (!idSlug || parseTripIdFromSlug(idSlug) === null) {
      setError('Nieprawidłowy identyfikator wycieczki');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getTrip(idSlug);
      setTrip(data);
      setLoading(false);

      if (data.gpx_filename) {
        setGpxLoading(true);
        try {
          const gpx = await getTripGpxData(data);
          setGpxData(gpx);
        } catch {
          setGpxData(null);
        } finally {
          setGpxLoading(false);
        }
      } else {
        setGpxData(null);
      }

      if (data.status === 'planowana' && data.forecast_weather_json) {
        const w = parseStoredWeather(data.forecast_weather_json);
        setWeatherSummary(formatWeatherForDate(w, data.date_start));
      } else if (data.status === 'zrealizowana' && data.official_weather_json) {
        const w = parseStoredWeather(data.official_weather_json);
        setWeatherSummary(formatWeatherForDate(w, data.date_start));
      } else {
        setWeatherSummary(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, [idSlug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const defaultTitle = 'Mountain Tracker';
    document.title = trip?.name ? `${defaultTitle} - ${trip.name}` : defaultTitle;
    return () => {
      document.title = defaultTitle;
    };
  }, [trip?.name]);

  async function handleFetchForecast() {
    if (!trip) return;
    try {
      const weather = await fetchTripForecast(trip);
      setWeatherSummary(formatWeatherForDate(weather, trip.date_start));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd pobierania prognozy');
    }
  }

  function handlePhotosChange(photos: TripPhoto[]) {
    setTrip((prev) => (prev ? { ...prev, photos } : prev));
  }

  async function handleSaveNotes(notes: string | null) {
    if (!trip) return;
    const updated = await updateTrip(trip, {
      name: trip.name,
      peak_name: trip.peak_name,
      date_start: trip.date_start,
      date_end: trip.date_end,
      notes,
      lat: trip.lat,
      lon: trip.lon,
      estimated_duration_min: trip.estimated_duration_min,
      actual_duration_min: trip.actual_duration_min,
      status: trip.status,
      water_start_ml: trip.water_start_ml,
      food_weight_g: trip.food_weight_g,
    });
    setTrip((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  function handleFitUploaded(result: FitUploadResult) {
    setLogisticsKey((k) => k + 1);
    setTrip((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fit_filename: result.fit_filename,
        fit_total_calories: result.total_calories,
        fit_water_ml: result.total_water_ml,
        actual_duration_min: result.actual_duration_min ?? prev.actual_duration_min,
      };
    });
  }

  function handleGpxUploaded(data: GpxData) {
    setGpxData(data);
    setLogisticsKey((k) => k + 1);
    setTrip((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        gpx_filename: 'route.gpx',
        route_distance_km: data.distance_km,
        route_elevation_gain_m: data.elevation_gain_m,
      };
      if (data.duration_min != null) {
        if (prev.status === 'planowana') {
          updated.estimated_duration_min = data.duration_min;
        } else {
          updated.actual_duration_min = data.duration_min;
        }
      }
      return updated;
    });
  }

  async function handleMarkCompleted() {
    if (!trip || trip.status !== 'planowana') return;
    setCompleting(true);
    setError('');
    try {
      const updated = await updateTrip(trip, {
        name: trip.name,
        peak_name: trip.peak_name,
        date_start: trip.date_start,
        date_end: trip.date_end,
        notes: trip.notes,
        lat: trip.lat,
        lon: trip.lon,
        estimated_duration_min: trip.estimated_duration_min,
        actual_duration_min: trip.actual_duration_min,
        status: 'zrealizowana',
        water_start_ml: trip.water_start_ml,
        food_weight_g: trip.food_weight_g,
      });
      setTrip((prev) => (prev ? { ...prev, ...updated } : prev));

      if (updated.official_weather_json) {
        const w = parseStoredWeather(updated.official_weather_json);
        setWeatherSummary(formatWeatherForDate(w, updated.date_start));
      } else {
        setWeatherSummary(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zmiany statusu');
    } finally {
      setCompleting(false);
    }
  }

  async function handleSaveTrip(input: TripInput) {
    if (!trip) return;
    const updated = await updateTrip(trip, input);
    setTrip((prev) => (prev ? { ...prev, ...updated } : prev));
    setLogisticsKey((k) => k + 1);

    if (updated.name !== trip.name) {
      navigate(tripPath(updated.id, updated.name), { replace: true });
    }

    if (updated.status === 'zrealizowana' && updated.official_weather_json) {
      const w = parseStoredWeather(updated.official_weather_json);
      setWeatherSummary(formatWeatherForDate(w, updated.date_start));
    } else if (updated.status === 'planowana' && updated.forecast_weather_json) {
      const w = parseStoredWeather(updated.forecast_weather_json);
      setWeatherSummary(formatWeatherForDate(w, updated.date_start));
    }
  }

  async function handleDelete() {
    if (!trip) return;
    try {
      await deleteTrip(trip);
      navigate('/wycieczki');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd usuwania');
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="text-muted">Ładowanie...</p>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="page">
        <Link to="/wycieczki" className="back-link">
          <ArrowLeft size={16} />
          Wycieczki
        </Link>
        <p className="error-msg">{error}</p>
      </div>
    );
  }

  if (!trip) return null;

  const est = formatDuration(trip.estimated_duration_min);
  const actual = formatDuration(trip.actual_duration_min);
  const showDuration =
    trip.status === 'planowana' ? !!est : !!(est || actual);

  return (
    <div className="page trip-details">
      <div className="trip-details-top">
        <Link to="/wycieczki" className="back-link">
          <ArrowLeft size={16} />
          Wycieczki
        </Link>
        <div className="trip-details-top-actions">
          {trip.is_owner !== false && (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil size={16} />
                Edytuj
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm danger-text"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={16} />
                Usuń
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <header className="trip-details-header card">
        <div className="trip-details-title">
          <h1>{trip.name}</h1>
          <span className={`badge badge-${trip.status}`}>
            {trip.status === 'planowana' ? 'Planowana' : 'Zrealizowana'}
          </span>
          {trip.is_owner !== false && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShareOpen(true)}
              >
                <Share2 size={16} />
                Do grupy
              </button>
              {trip.status === 'planowana' && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={completing}
                  onClick={handleMarkCompleted}
                >
                  <CheckCircle size={16} />
                  {completing ? 'Zapisywanie...' : 'Oznacz jako zrealizowaną'}
                </button>
              )}
            </div>
          )}
        </div>
        <p className="trip-peak">
          <Mountain size={16} />
          {trip.peak_name}
        </p>
        <p className="trip-dates">
          <Calendar size={16} />
          {formatDisplayDateRange(trip.date_start, trip.date_end)}
        </p>
        {showDuration && (
          <p className="text-muted">
            {trip.status === 'planowana' && est && <span>Szacowany czas: {est}</span>}
            {trip.status === 'zrealizowana' && (
              <>
                {est && <span>Szacowany czas: {est}</span>}
                {est && actual && ' · '}
                {actual && <span>Czas: {actual}</span>}
              </>
            )}
          </p>
        )}
        {trip.lat != null && trip.lon != null && (
          <p className="text-muted inline-flex items-center gap-1.5">
            <MapPin size={14} />
            <a
              href={`https://mapa-turystyczna.pl/coords/${trip.lat},${trip.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="trip-coords-link"
            >
              {trip.lat.toFixed(4)}, {trip.lon.toFixed(4)}
            </a>
          </p>
        )}
        <div className="trip-weather">
          {weatherSummary ? (
            <p className="forecast-summary">
              <CloudSun size={14} />
              {trip.status === 'planowana' ? 'Prognoza: ' : 'Pogoda z dnia wycieczki: '}
              {weatherSummary}
            </p>
          ) : trip.status === 'planowana' && trip.lat != null ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm -ml-[0.6rem]"
              onClick={handleFetchForecast}
            >
              <CloudSun size={14} />
              Pobierz prognozę
            </button>
          ) : null}
        </div>
      </header>

      {trip.group_id != null ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1 lg:w-1/2">
            <TripPackingSection
              trip={trip}
              status={trip.status}
              onPackingChange={handlePackingChange}
            />
          </div>
          <div className="min-w-0 flex-1 lg:w-1/2">
            <TripSharedPackingSection
              trip={trip}
              groupId={trip.group_id}
              status={trip.status}
              onPackingChange={handlePackingChange}
            />
          </div>
        </div>
      ) : (
        <TripPackingSection
          trip={trip}
          status={trip.status}
          onPackingChange={handlePackingChange}
        />
      )}

      <TripLogisticsSection
        trip={trip}
        tripSnapshot={logisticsTripSnapshot!}
        refreshKey={logisticsKey}
        fitFilename={trip.fit_filename}
        onFoodWeightChange={handleFoodWeightChange}
        onFitUploaded={handleFitUploaded}
      />

      <TripRouteSection
        trip={trip}
        hasGpx={!!trip.gpx_filename}
        distanceKm={trip.route_distance_km}
        elevationGainM={trip.route_elevation_gain_m}
        gpxData={gpxData}
        gpxLoading={gpxLoading}
        onGpxUploaded={handleGpxUploaded}
      />

      {trip.status === 'zrealizowana' && <TripRatingsSection trip={trip} />}

      <TripGallery
        trip={trip}
        photos={trip.photos}
        notes={trip.notes}
        onChange={handlePhotosChange}
        onSaveNotes={handleSaveNotes}
      />

      {editOpen && (
        <TripEditModal
          trip={trip}
          onSave={handleSaveTrip}
          onClose={() => setEditOpen(false)}
        />
      )}

      {shareOpen && (
        <ShareTripToGroupModal
          tripId={trip.id}
          onClose={() => setShareOpen(false)}
          onShared={load}
        />
      )}

      {deleteOpen && (
        <DeleteTripModal
          tripName={trip.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
