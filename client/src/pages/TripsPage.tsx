import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle, CloudSun, MapPin, Mountain, Pencil, Plus, Trash2, Upload, User, Users } from 'lucide-react';
import DeleteTripModal from '../components/DeleteTripModal';
import CompleteTripModal from '../components/trip/CompleteTripModal';
import TripCardMap from '../components/trip/TripCardMap';
import {
  createTrip,
  deleteTrip,
  fetchTripForecast,
  formatWeatherForDate,
  getTrips,
  parseGpxProfile,
  parseStoredWeather,
  updateTrip,
  uploadTripGpx,
} from '../api/trips';
import { parseGpxXml } from '@mountain-tracker/shared';
import { getGroups, type Group } from '../api/groups';
import type { Trip, TripInput, TripStatus } from '../types/trip';
import { tripPath } from '../utils/slugify';
import {
  UNKNOWN_TRIP_DATE,
  compareTripDates,
  formatDisplayDateRange,
  isUnknownTripDate,
} from '../utils/date';

const emptyForm: TripInput = {
  name: '',
  peak_name: '',
  date_start: '',
  date_end: '',
  status: undefined,
  notes: '',
  estimated_duration_min: null,
  actual_duration_min: null,
};

function formatDuration(min: number | null): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function getStatusLabel(status: TripStatus): string {
  return status === 'planowana' ? 'Planowana' : 'Zrealizowana';
}

export default function TripsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [form, setForm] = useState<TripInput>(emptyForm);
  const [peakNameManual, setPeakNameManual] = useState(false);
  const [dateEndManual, setDateEndManual] = useState(false);
  const [dateUnknown, setDateUnknown] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [forecastCache, setForecastCache] = useState<Record<number, string>>({});
  const [forecastLoading, setForecastLoading] = useState<number | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Trip | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [pendingGpxFile, setPendingGpxFile] = useState<File | null>(null);
  const [gpxPreview, setGpxPreview] = useState<string | null>(null);
  const [tripType, setTripType] = useState<'private' | 'group'>('private');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const trips = await getTrips();
      setItems(trips);

      const cached: Record<number, string> = {};
      for (const trip of trips) {
        if (trip.status === 'planowana' && trip.forecast_weather_json) {
          const weather = parseStoredWeather(trip.forecast_weather_json);
          const summary = formatWeatherForDate(weather, trip.date_start);
          if (summary) cached[trip.id] = summary;
        }
      }
      setForecastCache(cached);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const undatedOnly = searchParams.get('undated') === '1';

  const upcoming = items
    .filter((t) => t.status === 'planowana')
    .filter((t) => !undatedOnly || isUnknownTripDate(t.date_start))
    .sort((a, b) => compareTripDates(a.date_start, b.date_start, true));

  const completed = items
    .filter((t) => t.status === 'zrealizowana')
    .sort((a, b) => compareTripDates(a.date_start, b.date_start, false));

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setPeakNameManual(false);
    setDateEndManual(false);
    setDateUnknown(false);
    setPendingGpxFile(null);
    setGpxPreview(null);
    setTripType('private');
    setSelectedGroupId(null);
    setFormError('');
    setFormOpen(true);
    getGroups()
      .then(setUserGroups)
      .catch(() => setUserGroups([]));
  }

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openAdd();
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function openEdit(trip: Trip) {
    setEditing(trip);
    setPeakNameManual(true);
    setDateUnknown(isUnknownTripDate(trip.date_start));
    setDateEndManual(!!trip.date_end && trip.date_end !== trip.date_start);
    setForm({
      name: trip.name,
      peak_name: trip.peak_name,
      date_start: trip.date_start,
      date_end: trip.date_end ?? '',
      status: trip.status,
      notes: trip.notes ?? '',
      estimated_duration_min: trip.estimated_duration_min,
      actual_duration_min: trip.actual_duration_min,
    });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setPeakNameManual(false);
    setDateEndManual(false);
    setDateUnknown(false);
    setPendingGpxFile(null);
    setGpxPreview(null);
    setTripType('private');
    setSelectedGroupId(null);
    setFormError('');
  }

  function handleDateUnknownChange(unknown: boolean) {
    setDateUnknown(unknown);
    if (unknown) {
      setDateEndManual(false);
      setForm({
        ...form,
        date_start: UNKNOWN_TRIP_DATE,
        date_end: '',
      });
      return;
    }
    setForm({
      ...form,
      date_start: '',
      date_end: '',
    });
  }

  function handleDateStartChange(dateStart: string) {
    setForm({
      ...form,
      date_start: dateStart,
      date_end: !editing && !dateEndManual && dateStart ? dateStart : form.date_end,
    });
  }

  function handleDateEndChange(dateEnd: string) {
    setDateEndManual(true);
    setForm({ ...form, date_end: dateEnd });
  }

  function handleNameChange(name: string) {
    setForm({
      ...form,
      name,
      peak_name: peakNameManual ? form.peak_name : name,
    });
  }

  function handlePeakNameChange(peakName: string) {
    setPeakNameManual(true);
    setForm({ ...form, peak_name: peakName });
  }

  async function handleGpxSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setFormError('Dozwolony format trasy: .gpx');
      return;
    }

    try {
      const parsed = parseGpxXml(await file.text());
      setPendingGpxFile(file);
      const parts = [`${parsed.distance_km.toLocaleString('pl-PL')} km`];
      if (parsed.elevation_gain_m > 0) {
        parts.push(`${parsed.elevation_gain_m.toLocaleString('pl-PL')} m przewyższenia`);
      }
      if (parsed.duration_min != null) {
        parts.push(
          parsed.duration_estimated
            ? `szac. czas: ${parsed.duration_min} min`
            : `czas z GPX: ${parsed.duration_min} min`
        );
      }
      setGpxPreview(parts.join(' · '));
      setForm({
        ...form,
        estimated_duration_min: parsed.duration_min ?? form.estimated_duration_min,
      });
      setFormError('');
    } catch {
      setFormError('Nie udało się odczytać pliku GPX');
      setPendingGpxFile(null);
      setGpxPreview(null);
    } finally {
      if (gpxInputRef.current) gpxInputRef.current.value = '';
    }
  }

  function clearPendingGpx() {
    setPendingGpxFile(null);
    setGpxPreview(null);
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  }

  function validateForm(): string | null {
    if (!form.name.trim()) return 'Nazwa jest wymagana';
    if (!form.peak_name.trim()) return 'Nazwa szczytu jest wymagana';
    if (!dateUnknown && !form.date_start) return 'Data rozpoczęcia jest wymagana';
    if (
      !isUnknownTripDate(form.date_start) &&
      form.date_end &&
      form.date_end < form.date_start
    ) {
      return 'Data zakończenia nie może być wcześniejsza niż rozpoczęcia';
    }
    if (form.estimated_duration_min != null && form.estimated_duration_min <= 0) {
      return 'Szacowany czas musi być dodatni';
    }
    if (!editing && tripType === 'group' && !selectedGroupId) {
      return 'Wybierz grupę dla wycieczki grupowej';
    }
    if (
      editing &&
      form.actual_duration_min != null &&
      form.actual_duration_min <= 0
    ) {
      return 'Rzeczywisty czas musi być dodatni';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }

    const payload: TripInput = {
      name: form.name.trim(),
      peak_name: form.peak_name.trim(),
      date_start: dateUnknown ? UNKNOWN_TRIP_DATE : form.date_start,
      date_end: dateUnknown ? null : form.date_end?.toString().trim() || null,
      status: form.status,
      notes: form.notes?.toString().trim() || null,
      estimated_duration_min: form.estimated_duration_min
        ? Number(form.estimated_duration_min)
        : null,
      ...(editing
        ? {
            actual_duration_min: form.actual_duration_min
              ? Number(form.actual_duration_min)
              : null,
          }
        : {}),
      ...(!editing && tripType === 'group' && selectedGroupId
        ? { group_id: selectedGroupId }
        : {}),
    };

    try {
      if (editing) {
        await updateTrip(editing, payload);
      } else {
        const trip = await createTrip(payload);
        if (pendingGpxFile) {
          await uploadTripGpx(trip, pendingGpxFile);
        }
      }
      closeForm();
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Błąd zapisu');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTrip(deleteTarget);
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd usuwania');
      setDeleteTarget(null);
    }
  }

  async function handleCompleteTrip(trip: Trip) {
    setCompletingId(trip.id);
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
      setCompleteTarget(updated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zmiany statusu');
    } finally {
      setCompletingId(null);
    }
  }

  async function handleFetchForecast(trip: Trip) {
    setForecastLoading(trip.id);
    try {
      const weather = await fetchTripForecast(trip);
      const summary = formatWeatherForDate(weather, trip.date_start);
      if (summary) {
        setForecastCache((prev) => ({ ...prev, [trip.id]: summary }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd pobierania prognozy');
    } finally {
      setForecastLoading(null);
    }
  }

  function renderTripCard(trip: Trip) {
    const est = formatDuration(trip.estimated_duration_min);
    const actual = formatDuration(trip.actual_duration_min);
    const elevation = trip.route_elevation_gain_m;
    const forecast = forecastCache[trip.id];
    const gpxTrack = trip.gpx_filename ? parseGpxProfile(trip.gpx_profile_json) : null;
    const showMap =
      (gpxTrack && gpxTrack.length >= 2) || (trip.lat != null && trip.lon != null);

    return (
      <article key={trip.id} className="card trip-card">
        <div className="trip-card-top">
          <div className="trip-card-header">
            <h3>
              <Link to={tripPath(trip.id, trip.name)} className="trip-card-link">
                {trip.name}
              </Link>
            </h3>
            <span
              className="text-[var(--text-muted)]"
              title={trip.group_id != null ? 'Wycieczka grupowa' : 'Wycieczka prywatna'}
            >
              {trip.group_id != null ? <Users size={16} /> : <User size={16} />}
            </span>
            <span className={`badge badge-${trip.status}`}>{getStatusLabel(trip.status)}</span>
          </div>
          <div className="trip-card-actions">
            <button
              type="button"
              className="btn-icon"
              onClick={() => openEdit(trip)}
              aria-label="Edytuj"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="btn-icon danger"
              onClick={() => setDeleteTarget(trip)}
              aria-label="Usuń"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="trip-card-main">
          <div className="trip-card-body">
            <p className="trip-peak">
              <Mountain size={16} />
              {trip.peak_name}
            </p>
            <p className="trip-dates">
              <Calendar size={16} />
              {formatDisplayDateRange(trip.date_start, trip.date_end)}
            </p>
            {(est || (trip.status === 'zrealizowana' && actual) || elevation != null) && (
              <div className="trip-duration text-muted">
                {trip.status === 'planowana' && est && <p>Szacowany: {est}</p>}
                {trip.status === 'zrealizowana' && actual && <p>Czas: {actual}</p>}
                {trip.status === 'zrealizowana' && !actual && est && <p>Szacowany: {est}</p>}
                {elevation != null && <p>Podejście: {elevation}m</p>}
              </div>
            )}
            {trip.lat != null && trip.lon != null && (
              <p className="trip-coords text-muted">
                <MapPin size={16} />
                {trip.lat.toFixed(4)}, {trip.lon.toFixed(4)}
              </p>
            )}
            {trip.status === 'planowana' && trip.lat != null && !isUnknownTripDate(trip.date_start) && (
              <div className="trip-forecast">
                {forecast ? (
                  <p className="forecast-summary">
                    <CloudSun size={16} />
                    {forecast}
                  </p>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={forecastLoading === trip.id}
                    onClick={() => handleFetchForecast(trip)}
                  >
                    <CloudSun size={16} />
                    {forecastLoading === trip.id ? 'Pobieranie...' : 'Pobierz prognozę'}
                  </button>
                )}
              </div>
            )}
            {trip.status === 'planowana' && (
              <div className="trip-card-complete">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={completingId === trip.id}
                  onClick={() => handleCompleteTrip(trip)}
                >
                  <CheckCircle size={16} />
                  {completingId === trip.id ? 'Zapisywanie...' : 'Zatwierdź wykonanie'}
                </button>
              </div>
            )}
          </div>
          {showMap && (
            <Link to={tripPath(trip.id, trip.name)} className="trip-card-map-link" tabIndex={-1}>
              <TripCardMap lat={trip.lat} lon={trip.lon} track={gpxTrack} />
            </Link>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Wycieczki</h1>
          <p className="text-muted">{items.length} wycieczek</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          <Plus size={18} />
          Dodaj wycieczkę
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {loading && <p className="text-muted">Ładowanie...</p>}

      {!loading && (
        <>
          <section className="trip-section">
            <h2>{undatedOnly ? 'Zaplanowane — nieznana data' : 'Nadchodzące'}</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted">
                {undatedOnly
                  ? 'Brak zaplanowanych wycieczek z nieznaną datą.'
                  : 'Brak zaplanowanych wycieczek.'}
              </p>
            ) : (
              <div className="trip-grid">{upcoming.map(renderTripCard)}</div>
            )}
          </section>

          <section className="trip-section">
            <h2>Zrealizowane</h2>
            {completed.length === 0 ? (
              <p className="text-muted">Brak zrealizowanych wycieczek.</p>
            ) : (
              <div className="trip-grid">{completed.map(renderTripCard)}</div>
            )}
          </section>
        </>
      )}

      {formOpen && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edytuj wycieczkę' : 'Dodaj wycieczkę'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="trip-name">Nazwa *</label>
                <input
                  id="trip-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="peak-name" className="label-with-hint">
                  Nazwa szczytu *
                  <span className="form-hint-inline text-muted">
                    Kilka szczytów KGP? Rozdziel przecinkiem, np. Wysoka, Radziejowa
                  </span>
                </label>
                <input
                  id="peak-name"
                  value={form.peak_name}
                  onChange={(e) => handlePeakNameChange(e.target.value)}
                  required
                />
              </div>
              {!editing && (
                <div className="form-group">
                  <span className="mb-2 block font-medium">Typ wycieczki</span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                    <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
                      <input
                        type="radio"
                        name="trip-type"
                        checked={tripType === 'private'}
                        onChange={() => {
                          setTripType('private');
                          setSelectedGroupId(null);
                        }}
                        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />
                      Prywatna
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
                      <input
                        type="radio"
                        name="trip-type"
                        checked={tripType === 'group'}
                        onChange={() => setTripType('group')}
                        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />
                      Grupowa
                    </label>
                  </div>
                  {tripType === 'group' && (
                    <div className="mt-3">
                      {userGroups.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">
                          Nie należysz do żadnej grupy.{' '}
                          <Link to="/grupy" className="text-[var(--accent)] hover:underline">
                            Dołącz lub utwórz grupę
                          </Link>
                        </p>
                      ) : (
                        <>
                          <label htmlFor="trip-group" className="block mb-1 text-sm">
                            Grupa *
                          </label>
                          <select
                            id="trip-group"
                            value={selectedGroupId ?? ''}
                            onChange={(e) =>
                              setSelectedGroupId(e.target.value ? Number(e.target.value) : null)
                            }
                            required
                          >
                            <option value="">Wybierz grupę</option>
                            {userGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                                {g.member_count != null ? ` (${g.member_count} członków)` : ''}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="date-start">Data rozpoczęcia *</label>
                  <input
                    id="date-start"
                    type="date"
                    value={dateUnknown ? '' : form.date_start}
                    onChange={(e) => handleDateStartChange(e.target.value)}
                    disabled={dateUnknown}
                    required={!dateUnknown}
                  />
                  <label className="checkbox-label trip-date-unknown">
                    Nieznana
                    <input
                      type="checkbox"
                      checked={dateUnknown}
                      onChange={(e) => handleDateUnknownChange(e.target.checked)}
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label htmlFor="date-end">Data zakończenia</label>
                  <input
                    id="date-end"
                    type="date"
                    value={form.date_end ?? ''}
                    onChange={(e) => handleDateEndChange(e.target.value)}
                    disabled={dateUnknown}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={form.status ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: (e.target.value as TripStatus) || undefined,
                    })
                  }
                >
                  <option value="">
                    {editing ? 'Bez zmiany' : 'Automatycznie (z daty)'}
                  </option>
                  <option value="planowana">Planowana</option>
                  <option value="zrealizowana">Zrealizowana</option>
                </select>
                {!editing && (
                  <p className="form-hint text-muted">
                    {dateUnknown
                      ? 'Przy nieznanej dacie automatyczny status to „planowana”, jeśli nie wybierzesz ręcznie.'
                      : 'Przy tworzeniu status jest wyliczany z daty, jeśli nie wybierzesz ręcznie.'}
                  </p>
                )}
              </div>
              {!editing && (
                <div className="form-group">
                  <label htmlFor="trip-gpx">Plik GPX (opcjonalnie)</label>
                  <div className="trip-gpx-upload">
                    <input
                      ref={gpxInputRef}
                      id="trip-gpx"
                      type="file"
                      accept=".gpx"
                      hidden
                      onChange={handleGpxSelect}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => gpxInputRef.current?.click()}
                    >
                      <Upload size={16} />
                      {pendingGpxFile ? 'Zmień plik GPX' : 'Wybierz plik GPX'}
                    </button>
                    {pendingGpxFile && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={clearPendingGpx}>
                        Usuń
                      </button>
                    )}
                  </div>
                  {pendingGpxFile && (
                    <p className="form-hint text-muted">
                      {pendingGpxFile.name}
                      {gpxPreview ? ` — ${gpxPreview}` : ''}
                    </p>
                  )}
                </div>
              )}
              {editing ? (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="est-duration">Szacowany czas (min)</label>
                    <input
                      id="est-duration"
                      type="number"
                      min="1"
                      value={form.estimated_duration_min ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          estimated_duration_min: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="act-duration">Rzeczywisty czas (min)</label>
                    <input
                      id="act-duration"
                      type="number"
                      min="1"
                      value={form.actual_duration_min ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          actual_duration_min: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="est-duration">Szacowany czas (min)</label>
                  <input
                    id="est-duration"
                    type="number"
                    min="1"
                    value={form.estimated_duration_min ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        estimated_duration_min: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="notes">Notatki</label>
                <textarea
                  id="notes"
                  rows={3}
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              {formError && <p className="error-msg">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeForm}>
                  Anuluj
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Zapisz' : 'Dodaj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteTripModal
          tripName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {completeTarget && (
        <CompleteTripModal
          trip={completeTarget}
          onUploaded={() => {
            setCompleteTarget(null);
            load();
          }}
          onSkip={() => setCompleteTarget(null)}
        />
      )}
    </div>
  );
}
