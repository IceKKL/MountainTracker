import { useEffect, useState } from 'react';
import type { Trip, TripInput, TripStatus } from '../../types/trip';
import {
  UNKNOWN_TRIP_DATE,
  isUnknownTripDate,
} from '../../utils/date';

interface TripEditModalProps {
  trip: Trip;
  onSave: (input: TripInput) => Promise<void>;
  onClose: () => void;
}

export default function TripEditModal({ trip, onSave, onClose }: TripEditModalProps) {
  const [form, setForm] = useState<TripInput>({
    name: trip.name,
    peak_name: trip.peak_name,
    date_start: trip.date_start,
    date_end: trip.date_end ?? '',
    status: trip.status,
    notes: trip.notes ?? '',
    lat: trip.lat,
    lon: trip.lon,
    estimated_duration_min: trip.estimated_duration_min,
    actual_duration_min: trip.actual_duration_min,
    water_start_ml: trip.water_start_ml,
    food_weight_g: trip.food_weight_g,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dateUnknown, setDateUnknown] = useState(isUnknownTripDate(trip.date_start));

  useEffect(() => {
    setDateUnknown(isUnknownTripDate(trip.date_start));
    setForm({
      name: trip.name,
      peak_name: trip.peak_name,
      date_start: trip.date_start,
      date_end: trip.date_end ?? '',
      status: trip.status,
      notes: trip.notes ?? '',
      lat: trip.lat,
      lon: trip.lon,
      estimated_duration_min: trip.estimated_duration_min,
      actual_duration_min: trip.actual_duration_min,
      water_start_ml: trip.water_start_ml,
      food_weight_g: trip.food_weight_g,
    });
  }, [trip]);

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
    if (form.actual_duration_min != null && form.actual_duration_min <= 0) {
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
      lat: form.lat ?? null,
      lon: form.lon ?? null,
      estimated_duration_min: form.estimated_duration_min
        ? Number(form.estimated_duration_min)
        : null,
      actual_duration_min: form.actual_duration_min ? Number(form.actual_duration_min) : null,
      water_start_ml: form.water_start_ml ?? trip.water_start_ml,
      food_weight_g: form.food_weight_g ?? trip.food_weight_g,
    };

    setSaving(true);
    setFormError('');
    try {
      await onSave(payload);
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edytuj wycieczkę</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="trip-edit-name">Nazwa *</label>
            <input
              id="trip-edit-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="trip-edit-peak" className="label-with-hint">
              Nazwa szczytu *
              <span className="form-hint-inline text-muted">
                Kilka szczytów KGP? Rozdziel przecinkiem
              </span>
            </label>
            <input
              id="trip-edit-peak"
              value={form.peak_name}
              onChange={(e) => setForm({ ...form, peak_name: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="trip-edit-date-start">Data rozpoczęcia *</label>
              <input
                id="trip-edit-date-start"
                type="date"
                value={dateUnknown ? '' : form.date_start}
                onChange={(e) => setForm({ ...form, date_start: e.target.value })}
                disabled={dateUnknown}
                required={!dateUnknown}
              />
              <label className="checkbox-label trip-date-unknown">
                Nieznana
                <input
                  type="checkbox"
                  checked={dateUnknown}
                  onChange={(e) => {
                    const unknown = e.target.checked;
                    setDateUnknown(unknown);
                    setForm({
                      ...form,
                      date_start: unknown ? UNKNOWN_TRIP_DATE : '',
                      date_end: unknown ? '' : form.date_end,
                    });
                  }}
                />
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="trip-edit-date-end">Data zakończenia</label>
              <input
                id="trip-edit-date-end"
                type="date"
                value={form.date_end ?? ''}
                onChange={(e) => setForm({ ...form, date_end: e.target.value })}
                disabled={dateUnknown}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="trip-edit-status">Status</label>
            <select
              id="trip-edit-status"
              value={form.status ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: (e.target.value as TripStatus) || undefined,
                })
              }
            >
              <option value="planowana">Planowana</option>
              <option value="zrealizowana">Zrealizowana</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="trip-edit-lat">Szerokość geogr. (opcjonalnie)</label>
              <input
                id="trip-edit-lat"
                type="number"
                step="any"
                value={form.lat ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lat: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="trip-edit-lon">Długość geogr. (opcjonalnie)</label>
              <input
                id="trip-edit-lon"
                type="number"
                step="any"
                value={form.lon ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lon: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="trip-edit-est">Szacowany czas (min)</label>
              <input
                id="trip-edit-est"
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
            <div className="form-group">
              <label htmlFor="trip-edit-act">Rzeczywisty czas (min)</label>
              <input
                id="trip-edit-act"
                type="number"
                min="1"
                value={form.actual_duration_min ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    actual_duration_min: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
          {formError && <p className="error-msg">{formError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Anuluj
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
