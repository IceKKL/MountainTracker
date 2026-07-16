import { useCallback, useEffect, useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import {
  computeAverage,
  deleteTripRating,
  getTripRatings,
  upsertTripRating,
} from '../../api/trips';
import type { TripRef } from '../../api/trips';
import type { TripRatingItem } from '../../types/trip';

const DEFAULT_CATEGORIES = ['Szczyt', 'Trasa'];

function scoreBackground(score: number): string {
  const t = Math.max(0, Math.min(10, score)) / 10;
  const r = Math.round(196 + (122 - 196) * t);
  const g = Math.round(140 + (159 - 140) * t);
  const b = Math.round(132 + (101 - 132) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

interface Props {
  trip: TripRef;
}

export default function TripRatingsSection({ trip }: Props) {
  const [ratings, setRatings] = useState<TripRatingItem[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTripRatings(trip);
      setRatings(data.ratings);
      setAverage(data.average);
      const nextDrafts: Record<string, string> = {};
      for (const cat of DEFAULT_CATEGORIES) {
        const found = data.ratings.find((r) => r.category === cat);
        nextDrafts[cat] = found != null ? String(found.score) : '';
      }
      for (const r of data.ratings) {
        if (!(r.category in nextDrafts)) nextDrafts[r.category] = String(r.score);
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania ocen');
    } finally {
      setLoading(false);
    }
  }, [trip]);

  useEffect(() => {
    load();
  }, [load]);

  const displayCategories = [
    ...DEFAULT_CATEGORIES,
    ...ratings.map((r) => r.category).filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  ];
  const uniqueCategories = [...new Set(displayCategories)];

  const localAverage = computeAverage(
    uniqueCategories
      .map((cat) => {
        const val = drafts[cat];
        if (val === '' || val === undefined) return null;
        const n = Number(val);
        return Number.isNaN(n) ? null : n;
      })
      .filter((n): n is number => n != null)
  );

  async function saveRating(category: string) {
    const raw = drafts[category];
    if (raw === '' || raw === undefined) return;
    const score = Number(raw);
    if (Number.isNaN(score) || score < 0 || score > 10) {
      setError('Ocena musi być w zakresie 0–10');
      return;
    }
    setError('');
    try {
      const data = await upsertTripRating(trip, category, score);
      setRatings(data.ratings);
      setAverage(data.average);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu oceny');
    }
  }

  async function handleAddCategory() {
    const cat = newCategory.trim();
    if (!cat) return;
    if (uniqueCategories.includes(cat)) {
      setError('Ta kategoria już istnieje');
      return;
    }
    setDrafts((d) => ({ ...d, [cat]: '' }));
    setNewCategory('');
    setError('');
  }

  async function handleRemove(category: string) {
    if (!ratings.some((r) => r.category === category)) {
      setDrafts((d) => {
        const next = { ...d };
        delete next[category];
        return next;
      });
      return;
    }
    try {
      const data = await deleteTripRating(trip, category);
      setRatings(data.ratings);
      setAverage(data.average);
      setDrafts((d) => {
        const next = { ...d };
        delete next[category];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd usuwania oceny');
    }
  }

  const shownAverage = localAverage ?? average;

  return (
    <section className="trip-details-section card ratings-section">
      <div className="ratings-section-body">
        <div className="section-header">
          <h2>
            <Star size={18} />
            Oceny wycieczki
          </h2>
        </div>

        {error && <p className="error-msg">{error}</p>}

        {loading ? (
          <p className="text-muted">Ładowanie...</p>
        ) : (
          <>
            <div className="ratings-grid">
            {uniqueCategories.map((category) => (
              <div key={category} className="rating-row">
                <label className="rating-label" htmlFor={`rating-${category}`}>
                  {category}
                </label>
                <input
                  id={`rating-${category}`}
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  className="rating-input"
                  value={drafts[category] ?? ''}
                  placeholder="0–10"
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [category]: e.target.value }))
                  }
                  onBlur={() => saveRating(category)}
                />
                <button
                  type="button"
                  className="btn-icon danger"
                  title="Usuń kategorię"
                  onClick={() => handleRemove(category)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

            <div className="rating-add">
              <input
                type="text"
                placeholder="Nowa kategoria, np. Pogoda"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddCategory}>
                <Plus size={14} />
                Dodaj kategorię
              </button>
            </div>
          </>
        )}
      </div>

      {shownAverage != null && (
        <div
          className="rating-average-score"
          style={{ backgroundColor: scoreBackground(shownAverage) }}
          title="Wynik końcowy"
        >
          <span className="rating-average-value">{shownAverage}</span>
          <span className="rating-average-suffix">/10</span>
        </div>
      )}
    </section>
  );
}
