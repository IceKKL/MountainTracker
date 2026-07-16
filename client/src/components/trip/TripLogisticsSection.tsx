import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Scale, Upload, Watch } from 'lucide-react';
import { getTripLogistics, updateTrip, uploadTripFit } from '../../api/trips';
import type { FitUploadResult, TripRef } from '../../api/trips';
import type { Trip, TripInput, TripLogisticsResponse } from '../../types/trip';

interface TripLogisticsSectionProps {
  trip: TripRef;
  tripSnapshot: Pick<
    Trip,
    | 'name'
    | 'peak_name'
    | 'date_start'
    | 'date_end'
    | 'status'
    | 'notes'
    | 'lat'
    | 'lon'
    | 'estimated_duration_min'
    | 'actual_duration_min'
    | 'water_start_ml'
    | 'food_weight_g'
  >;
  refreshKey?: number;
  fitFilename?: string | null;
  onFoodWeightChange?: (foodWeightG: number) => void;
  onFitUploaded?: (result: FitUploadResult) => void;
}

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g} g`;
}

function clampWaterStart(ml: number, plannedWaterMl: number | null): number {
  if (plannedWaterMl != null && ml > plannedWaterMl) return plannedWaterMl;
  return ml;
}

function waterSliderMax(plannedWaterMl: number | null, current: number): number {
  return plannedWaterMl ?? Math.max(current, 3000);
}

function formatBalanceValue(value: number, unit: string): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value} ${unit}`;
}

function BalanceCell({ value, unit }: { value: number | null; unit: string }) {
  if (value == null) return <>—</>;

  const tone = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : null;

  return (
    <span className={`trip-logistics-balance trip-logistics-balance--${tone}`}>
      {formatBalanceValue(value, unit)}
      {Icon && <Icon size={14} aria-hidden />}
    </span>
  );
}

export default function TripLogisticsSection({
  trip,
  tripSnapshot,
  refreshKey = 0,
  fitFilename = null,
  onFoodWeightChange,
  onFitUploaded,
}: TripLogisticsSectionProps) {
  const [logistics, setLogistics] = useState<TripLogisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fitUploading, setFitUploading] = useState(false);
  const [fitError, setFitError] = useState('');
  const fitInputRef = useRef<HTMLInputElement>(null);
  const [waterStart, setWaterStart] = useState(tripSnapshot.water_start_ml ?? 2000);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFoodWeightChangeRef = useRef(onFoodWeightChange);
  const tripSnapshotRef = useRef(tripSnapshot);
  const tripRef = useRef(trip);

  onFoodWeightChangeRef.current = onFoodWeightChange;
  tripSnapshotRef.current = tripSnapshot;
  tripRef.current = trip;

  const prevTripIdRef = useRef(trip.id);
  const plannedWaterMl = logistics?.planned?.water_ml ?? null;

  useEffect(() => {
    const initial = prevTripIdRef.current !== trip.id;
    prevTripIdRef.current = trip.id;

    if (initial) {
      setLogistics(null);
      setLoading(true);
    }

    let cancelled = false;
    setError('');

    (async () => {
      try {
        const data = await getTripLogistics(trip);
        if (cancelled) return;
        setLogistics(data);
        setWaterStart(clampWaterStart(data.water_start_ml, data.planned?.water_ml ?? null));
        if (data.food_weight_g !== tripSnapshotRef.current.food_weight_g) {
          onFoodWeightChangeRef.current?.(data.food_weight_g);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Błąd ładowania logistyki');
        }
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trip.id, trip.name, refreshKey]);

  useEffect(() => {
    setWaterStart(
      clampWaterStart(tripSnapshot.water_start_ml ?? 2000, logistics?.planned?.water_ml ?? null)
    );
  }, [tripSnapshot.water_start_ml, logistics?.planned?.water_ml]);

  function saveWaterStart(value: number) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const snapshot = tripSnapshotRef.current;
      try {
        const payload: TripInput = {
          name: snapshot.name,
          peak_name: snapshot.peak_name,
          date_start: snapshot.date_start,
          date_end: snapshot.date_end,
          status: snapshot.status,
          notes: snapshot.notes,
          lat: snapshot.lat,
          lon: snapshot.lon,
          estimated_duration_min: snapshot.estimated_duration_min,
          actual_duration_min: snapshot.actual_duration_min,
          water_start_ml: value,
          food_weight_g: snapshot.food_weight_g,
        };
        await updateTrip(tripRef.current, payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Błąd zapisu wody startowej');
      }
    }, 400);
  }

  function handleWaterChange(value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    const max = waterSliderMax(plannedWaterMl, waterStart);
    const next = Math.min(Math.round(value), max);
    setWaterStart(next);
    saveWaterStart(next);
  }

  async function handleFitUpload(file: File) {
    if (!file.name.toLowerCase().endsWith('.fit')) {
      setFitError('Dozwolony format: .fit');
      return;
    }
    setFitUploading(true);
    setFitError('');
    try {
      const result = await uploadTripFit(trip, file);
      const data = await getTripLogistics(trip);
      setLogistics(data);
      onFitUploaded?.(result);
    } catch (e) {
      setFitError(e instanceof Error ? e.message : 'Błąd wgrywania pliku');
    } finally {
      setFitUploading(false);
    }
  }

  const waterMax = logistics ? waterSliderMax(plannedWaterMl, waterStart) : 3000;
  const waterOnTrail =
    plannedWaterMl != null ? Math.max(0, plannedWaterMl - waterStart) : null;
  const trailPackWeight = logistics
    ? logistics.base_weight_g + waterStart + logistics.food_weight_g
    : 0;
  const needsWaterFilter =
    logistics != null &&
    waterOnTrail != null &&
    waterOnTrail > 0 &&
    !logistics.has_water_filter;
  const sliderProgress = waterMax > 0 ? (waterStart / waterMax) * 100 : 0;
  const isPlanned = tripSnapshot.status === 'planowana';
  const isCompleted = tripSnapshot.status === 'zrealizowana';
  const showNutritionTable =
    logistics?.planned != null || (isCompleted && logistics?.actual != null);
  const showFaktyczne = isCompleted && logistics?.actual != null;
  const showBilans =
    isCompleted && logistics?.planned != null && logistics?.actual != null;
  const waterBalance =
    showBilans && logistics?.planned && logistics?.actual
      ? logistics.actual.water_ml != null
        ? logistics.planned.water_ml - logistics.actual.water_ml
        : null
      : null;
  const kcalBalance =
    showBilans && logistics?.planned && logistics?.actual
      ? logistics.planned.food_kcal - logistics.actual.food_kcal
      : null;

  return (
    <section className="trip-details-section card trip-logistics">
      <div className="section-header">
        <h2>
          <Scale size={20} />
          Logistyka i waga
        </h2>
      </div>

      {loading && !logistics && <p className="text-muted">Obliczanie...</p>}
      {error && <p className="error-msg">{error}</p>}

      {logistics && (
        <>
          <div className="trip-logistics-grid">
            <div className="trip-logistics-stat">
              <span className="label">Sprzęt w plecaku</span>
              <span className="value">{formatWeight(logistics.base_weight_g)}</span>
            </div>
            <div className="trip-logistics-stat">
              <span className="label">Na sobie</span>
              <span className="value">{formatWeight(logistics.worn_weight_g)}</span>
            </div>
            {logistics.food_weight_g > 0 && (
              <div className="trip-logistics-stat">
                <span className="label">Waga jedzenia w plecaku</span>
                <span className="value">{formatWeight(logistics.food_weight_g)}</span>
              </div>
            )}
          </div>

          {showNutritionTable && (
            <div className="trip-logistics-comparison">
              <h3 className="trip-logistics-nutrition-title">
                {showFaktyczne ? 'Porównanie zapotrzebowania' : 'Szacowane zapotrzebowanie'}
              </h3>
              <table className="trip-logistics-comparison-table">
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">Woda</th>
                    <th scope="col">Kalorie</th>
                  </tr>
                </thead>
                <tbody>
                  {logistics.planned && (
                    <tr>
                      <th scope="row">Szacowane</th>
                      <td>{logistics.planned.water_ml} ml</td>
                      <td>{logistics.planned.food_kcal} kcal</td>
                    </tr>
                  )}
                  {showFaktyczne && logistics.actual && (
                    <tr>
                      <th scope="row">Faktyczne</th>
                      <td>
                        {logistics.actual.water_ml != null
                          ? `${logistics.actual.water_ml} ml`
                          : 'brak danych'}
                      </td>
                      <td>{logistics.actual.food_kcal} kcal</td>
                    </tr>
                  )}
                  {showBilans && (
                    <tr className="trip-logistics-comparison-bilans">
                      <th scope="row">Bilans</th>
                      <td>
                        <BalanceCell value={waterBalance} unit="ml" />
                      </td>
                      <td>
                        <BalanceCell value={kcalBalance} unit="kcal" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {isPlanned && (
            <div className="trip-logistics-water">
              <div className="trip-logistics-water-header">
                <label htmlFor="water-start">Woda startowa (w plecaku)</label>
                <span className="trip-logistics-water-value">{waterStart} ml</span>
              </div>
              {plannedWaterMl != null ? (
                <p className="trip-logistics-water-target text-muted">
                  Plan na trasie: {plannedWaterMl} ml
                  {waterOnTrail != null && waterOnTrail > 0 && (
                    <> · brakuje {waterOnTrail} ml</>
                  )}
                </p>
              ) : (
                <p className="trip-logistics-water-target text-muted">
                  Wgraj GPX, aby ustawić górną granicę według planowanego zapotrzebowania.
                </p>
              )}
              <input
                id="water-start"
                type="range"
                className="trip-logistics-slider"
                min={0}
                max={waterMax}
                step={50}
                value={waterStart}
                onChange={(e) => handleWaterChange(Number(e.target.value))}
                style={{ '--slider-progress': `${sliderProgress}%` } as CSSProperties}
                aria-valuemin={0}
                aria-valuemax={waterMax}
                aria-valuenow={waterStart}
                aria-valuetext={`${waterStart} mililitrów`}
              />
              <div className="trip-logistics-slider-labels">
                <span>0 ml</span>
                <span>{waterMax} ml</span>
              </div>
            </div>
          )}

          <p className="trip-logistics-total">
            Waga plecaku na szlaku: {formatWeight(trailPackWeight)}
            <span className="trip-logistics-total-sep">|</span>
            Waga ubrań/butów na sobie: {formatWeight(logistics.worn_weight_g)}
          </p>

          {!logistics.has_gpx_data && (
            <p className="trip-logistics-hint text-muted">
              Wgraj trasę GPX, aby wyliczyć plan zapotrzebowania na wodę i jedzenie.
            </p>
          )}

          {tripSnapshot.status === 'zrealizowana' && (
            <div className="trip-logistics-fit">
              <p className="trip-logistics-fit-hint text-muted">
                <Watch size={14} />
                Plik .fit z zegarka Garmin uzupełnia sekcję porównania (kalorie i woda). Waga
                plecaku opiera się wyłącznie na zapasie startowym z planu.
              </p>
              <input
                ref={fitInputRef}
                type="file"
                accept=".fit"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFitUpload(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={fitUploading}
                onClick={() => fitInputRef.current?.click()}
              >
                <Upload size={16} />
                {fitUploading
                  ? 'Wgrywanie...'
                  : fitFilename
                    ? 'Podmień dane z zegarka (.fit)'
                    : 'Wgraj dane z zegarka (.fit)'}
              </button>
              {fitError && <p className="error-msg">{fitError}</p>}
            </div>
          )}

          {isPlanned && needsWaterFilter && waterOnTrail != null && (
            <div className="logistics-warning-banner" role="alert">
              <AlertTriangle size={20} />
              <p>
                Na trasie brakuje {waterOnTrail} ml wody względem zapasu startowego. Weź filtr do
                wody z potoków — nie masz go na liście pakowania.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
