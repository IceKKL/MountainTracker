import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Backpack,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Shirt,
  Trash2,
  Zap,
} from 'lucide-react';
import { getGear } from '../../api/gear';
import { addTripGear, getTripPacking, removeTripGear, setTripPacked, setTripWorn } from '../../api/trips';
import type { TripRef } from '../../api/trips';
import { GEAR_CATEGORIES, getCategoryIcon } from '../../constants/gearCategories';
import type { Gear } from '../../types/gear';
import type { TripPackingItem, TripStatus } from '../../types/trip';

interface Props {
  trip: TripRef;
  status: TripStatus;
  onPackingChange?: () => void;
}

export default function TripPackingSection({ trip, status, onPackingChange }: Props) {
  const [items, setItems] = useState<TripPackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [allGear, setAllGear] = useState<Gear[]>([]);
  const [gearLoading, setGearLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTripPacking(trip);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania listy pakowania');
    } finally {
      setLoading(false);
    }
  }, [trip]);

  useEffect(() => {
    load();
  }, [load]);

  const assignedIds = useMemo(() => new Set(items.map((i) => i.gear_id)), [items]);

  const availableGear = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allGear.filter((g) => {
      if (assignedIds.has(g.id)) return false;
      if (categoryFilter && g.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        (g.brand?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allGear, assignedIds, search, categoryFilter]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, TripPackingItem[]>();
    for (const item of items) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const ordered: { category: string; items: TripPackingItem[] }[] = [];
    for (const cat of GEAR_CATEGORIES) {
      const catItems = byCategory.get(cat.value);
      if (catItems?.length) ordered.push({ category: cat.value, items: catItems });
    }
    for (const [category, catItems] of byCategory) {
      if (!GEAR_CATEGORIES.some((c) => c.value === category)) {
        ordered.push({ category, items: catItems });
      }
    }
    return ordered;
  }, [items]);

  async function openAddModal() {
    setAddOpen(true);
    setSearch('');
    setCategoryFilter('');
    setGearLoading(true);
    try {
      const data = await getGear();
      setAllGear(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania sprzętu');
      setAddOpen(false);
    } finally {
      setGearLoading(false);
    }
  }

  function closeAddModal() {
    setAddOpen(false);
    setSearch('');
    setCategoryFilter('');
  }

  async function handleToggleWorn(gearId: number, is_worn: boolean) {
    const prev = items;
    setItems((list) => list.map((i) => (i.gear_id === gearId ? { ...i, is_worn } : i)));
    try {
      await setTripWorn(trip, gearId, is_worn);
      onPackingChange?.();
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    }
  }

  async function handleToggle(gearId: number, packed: boolean) {
    const prev = items;
    setItems((list) => list.map((i) => (i.gear_id === gearId ? { ...i, packed } : i)));
    try {
      await setTripPacked(trip, gearId, packed);
      onPackingChange?.();
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    }
  }

  async function handleAdd(gear: Gear) {
    try {
      const added = await addTripGear(trip, gear.id);
      setItems((list) => [...list, added]);
      onPackingChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd dodawania sprzętu');
    }
  }

  async function handleRemove(gearId: number) {
    const prev = items;
    setItems((list) => list.filter((i) => i.gear_id !== gearId));
    try {
      await removeTripGear(trip, gearId);
      onPackingChange?.();
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : 'Błąd usuwania sprzętu');
    }
  }

  const packedCount = items.filter((i) => i.packed).length;
  const allPacked = items.length > 0 && packedCount === items.length;

  function renderToggle() {
    return (
      <button
        type="button"
        className="packing-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            <ChevronUp size={16} />
            Zwiń listę pakowania
          </>
        ) : (
          <>
            <ChevronDown size={16} />
            Rozwiń listę pakowania
          </>
        )}
      </button>
    );
  }

  return (
    <section className="trip-details-section card packing-section">
      <div className="section-header">
        <h2>
          <Backpack size={18} />
          Lista pakowania
        </h2>
        <div className="packing-header-actions">
          {items.length > 0 && (
            <span className="text-muted packing-summary">
              Spakowano: {packedCount}/{items.length}
            </span>
          )}
          <button
            type="button"
            className="btn-icon"
            onClick={openAddModal}
            aria-label="Dodaj sprzęt"
            title="Dodaj sprzęt"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {!loading && items.length > 0 && status === 'planowana' && (
        <div
          className={`packing-status ${allPacked ? 'packing-status-complete' : 'packing-status-incomplete'}`}
        >
          {allPacked ? (
            <>
              <CheckCircle size={16} aria-hidden />
              <span>Cały sprzęt spakowany — lista gotowa do wyjścia</span>
            </>
          ) : (
            <>
              <Zap size={16} aria-hidden />
              <span>
                Nie wszystko spakowane — zostało {items.length - packedCount}{' '}
                {items.length - packedCount === 1 ? 'element' : 'elementów'}
              </span>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-muted">Ładowanie...</p>
      ) : items.length === 0 ? (
        <p className="text-muted">
          Brak sprzętu na liście. Kliknij <strong>+</strong>, aby dodać elementy z bazy
          lub oznacz sprzęt jako podstawowy w zakładce Sprzęt — zostanie dodany automatycznie
          przy tworzeniu wycieczki.
        </p>
      ) : (
        <>
          {renderToggle()}
          {expanded && (
            <div className="packing-groups">
              {grouped.map(({ category, items: catItems }) => {
                const Icon =
                  GEAR_CATEGORIES.find((c) => c.value === category)?.icon ?? Backpack;
                return (
                  <div key={category} className="packing-category">
                    <h3 className="packing-category-title">
                      <Icon size={16} />
                      {category}
                    </h3>
                    <ul className="packing-list">
                      {catItems.map((item) => (
                        <li key={item.gear_id} className="packing-item">
                          <label className="packing-label">
                            <input
                              type="checkbox"
                              checked={item.packed}
                              onChange={(e) => handleToggle(item.gear_id, e.target.checked)}
                            />
                            <span className="packing-name">{item.name}</span>
                          </label>
                          <div className="packing-item-actions">
                            <button
                              type="button"
                              className={`packing-worn-toggle ${item.is_worn ? 'packing-worn-toggle-on' : ''}`}
                              onClick={() => handleToggleWorn(item.gear_id, !item.is_worn)}
                              aria-label={
                                item.is_worn
                                  ? `${item.name}: na sobie — przełącz do plecaka`
                                  : `${item.name}: w plecaku — przełącz na siebie`
                              }
                              title={item.is_worn ? 'Na sobie' : 'W plecaku'}
                            >
                              {item.is_worn ? <Shirt size={16} /> : <Backpack size={16} />}
                            </button>
                            <button
                              type="button"
                              className="btn-icon danger packing-remove"
                              onClick={() => handleRemove(item.gear_id)}
                              aria-label={`Usuń ${item.name} z wycieczki`}
                              title="Usuń z wycieczki"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          {expanded && renderToggle()}
        </>
      )}

      {addOpen &&
        createPortal(
          <div className="modal-overlay" onClick={closeAddModal}>
            <div className="modal modal-gear-picker" onClick={(e) => e.stopPropagation()}>
              <h2>Dodaj sprzęt do wycieczki</h2>

              <div className="gear-picker-filters">
                <div className="gear-picker-search">
                  <Search size={16} />
                  <input
                    type="search"
                    placeholder="Szukaj po nazwie, marce…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filtr kategorii"
                >
                  <option value="">Wszystkie kategorie</option>
                  {GEAR_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
              </div>

              {gearLoading ? (
                <p className="text-muted">Ładowanie sprzętu...</p>
              ) : availableGear.length === 0 ? (
                <p className="text-muted gear-picker-empty">
                  {allGear.length === 0
                    ? 'Brak sprzętu w bazie — dodaj go w zakładce Sprzęt.'
                    : 'Brak pasujących elementów lub wszystkie są już na liście.'}
                </p>
              ) : (
                <ul className="gear-picker-list">
                  {availableGear.map((gear) => {
                    const Icon = getCategoryIcon(gear.category);
                    return (
                      <li key={gear.id}>
                        <button
                          type="button"
                          className="gear-picker-item"
                          onClick={() => handleAdd(gear)}
                        >
                          <span className="gear-picker-icon">
                            <Icon size={18} />
                          </span>
                          <span className="gear-picker-info">
                            <span className="gear-picker-name">{gear.name}</span>
                            <span className="gear-picker-meta text-muted">
                              <span>{gear.category}</span>
                              {gear.brand && <span>{gear.brand}</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeAddModal}>
                  Zamknij
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
