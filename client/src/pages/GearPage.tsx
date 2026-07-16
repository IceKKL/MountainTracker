import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Pencil, Plus, Trash2 } from 'lucide-react';
import { createGear, deleteGear, getGear, getGearStats, patchGearDefault, updateGear } from '../api/gear';
import GearFiltersBar from '../components/gear/GearFiltersBar';
import {
  GEAR_CATEGORIES,
  GEAR_SEASONS,
  getCategoryIcon,
  getSeasonLabel,
  isCodzienneCategory,
} from '../constants/gearCategories';
import {
  EMPTY_GEAR_FILTERS,
  type GearFilters,
  type GearGroupBy,
  filterGear,
  groupGear,
} from '../lib/gearFilters';
import type { Gear, GearInput, GearSeason, GearStatsItem } from '../types/gear';

const emptyForm: GearInput = {
  name: '',
  category: GEAR_CATEGORIES[0].value,
  season: 'uniwersalny',
  brand: '',
  weight_g: null,
  price: null,
  purchase_date: null,
  notes: '',
};

function formatPln(value: number): string {
  return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
}

function formatCost(value: number | null): string {
  if (value == null) return '—';
  return formatPln(value);
}

function hasValidPrice(price: number | null | undefined): boolean {
  return price != null && price > 0;
}

function escapeMdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function copyGearToMarkdown(
  items: Gear[],
  statsMap: Map<number, GearStatsItem>
): string {
  const headers = [
    'Nazwa',
    'Kategoria',
    'Sezon',
    'Marka',
    'Waga (g)',
    'Cena (PLN)',
    'Przebieg (km)',
    'Wypady',
    'Koszt/km',
    'Koszt/wypad',
  ];

  function fmtMissing(value: string | number | null | undefined): string {
    if (value == null || value === '') return 'Brak';
    return escapeMdCell(String(value));
  }

  function fmtWeight(weightG: number | null | undefined): string {
    if (weightG == null) return 'Brak';
    return escapeMdCell(`${weightG} g`);
  }

  function fmtDistance(km: number | null | undefined): string {
    if (km == null) return 'Brak';
    return escapeMdCell(`${km.toFixed(2).replace('.', ',')} km`);
  }

  function fmtZloty(value: number | null | undefined): string {
    if (value == null) return 'Brak';
    return escapeMdCell(`${value.toFixed(2).replace('.', ',')} zł`);
  }

  function fmtTripCount(count: number | null | undefined): string {
    if (count == null) return 'Brak';
    return escapeMdCell(String(count));
  }

  const rows = items.map((item) => {
    const usage = statsMap.get(item.id);
    const codzienne = isCodzienneCategory(item.category);

    let przebieg: string;
    let wypady: string;
    let kosztKm: string;
    let kosztWypad: string;

    if (codzienne) {
      przebieg = escapeMdCell('0 km');
      wypady = 'Brak';
      kosztKm = 'Brak';
      kosztWypad = 'Brak';
    } else {
      przebieg = fmtDistance(usage?.total_km);
      wypady = fmtTripCount(usage?.trip_count);
      kosztKm = fmtZloty(usage?.cost_per_km);
      kosztWypad = fmtZloty(usage?.cost_per_trip);
    }

    return [
      fmtMissing(item.name),
      fmtMissing(item.category),
      fmtMissing(getSeasonLabel(item.season)),
      fmtMissing(item.brand),
      fmtWeight(item.weight_g),
      fmtZloty(item.price),
      przebieg,
      wypady,
      kosztKm,
      kosztWypad,
    ];
  });

  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map((row) => `| ${row.join(' | ')} |`);

  return [headerRow, separator, ...dataRows].join('\n');
}

interface GearCardProps {
  item: Gear;
  usage: GearStatsItem | undefined;
  onEdit: (item: Gear) => void;
  onDelete: (id: number) => void;
  onDefaultToggle: (item: Gear, isDefault: boolean) => void;
}

function GearCard({ item, usage, onEdit, onDelete, onDefaultToggle }: GearCardProps) {
  const Icon = getCategoryIcon(item.category);
  const codzienne = isCodzienneCategory(item.category);
  const showUsage = !codzienne && usage && usage.trip_count > 0;
  const showCost = showUsage && hasValidPrice(usage.price);
  const showCostPerKm = showCost && item.category === 'Buty' && usage!.cost_per_km != null;

  return (
    <article className="card gear-card">
      <div className="gear-card-icon">
        <Icon size={28} />
      </div>
      <div className="gear-card-body">
        <h3>{item.name}</h3>
        <p className="text-muted">{item.category}</p>
        {item.brand && <p className="gear-brand">{item.brand}</p>}
        <div className="gear-meta">
          <span className={`badge badge-${item.season}`}>{getSeasonLabel(item.season)}</span>
          {item.weight_g && <span className="gear-weight">{item.weight_g} g</span>}
          {hasValidPrice(item.price) && (
            <span className="gear-weight">{formatPln(item.price!)}</span>
          )}
        </div>
        {showUsage && (
          <div className="gear-usage-stats">
            <p>
              <span className="inline-block max-w-full whitespace-nowrap">
                Przebieg: {usage!.total_km.toLocaleString('pl-PL')} km
                <span className="text-stone-400" aria-hidden="true">
                  {' '}
                  •{' '}
                </span>
                {usage!.trip_count} {usage!.trip_count === 1 ? 'wypad' : 'wypadów'}
              </span>
            </p>
            {showCost && (
              <p>
                <span className="inline-block max-w-full whitespace-nowrap">
                  Koszt:{' '}
                  {showCostPerKm && (
                    <>
                      {formatCost(usage!.cost_per_km)}/km
                      <span className="text-stone-400" aria-hidden="true">
                        {' '}
                        •{' '}
                      </span>
                    </>
                  )}
                  {formatCost(usage!.cost_per_trip)}/wypad
                </span>
              </p>
            )}
          </div>
        )}
        <label className="gear-default-toggle">
          <input
            type="checkbox"
            checked={item.is_default}
            onChange={(e) => onDefaultToggle(item, e.target.checked)}
          />
          <span>Sprzęt podstawowy</span>
        </label>
      </div>
      <div className="gear-card-actions">
        <button type="button" className="btn-icon" onClick={() => onEdit(item)} aria-label="Edytuj">
          <Pencil size={16} />
        </button>
        <button
          type="button"
          className="btn-icon danger"
          onClick={() => onDelete(item.id)}
          aria-label="Usuń"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

export default function GearPage() {
  const [allItems, setAllItems] = useState<Gear[]>([]);
  const [statsMap, setStatsMap] = useState<Map<number, GearStatsItem>>(new Map());
  const [totals, setTotals] = useState({ all_time: 0, current_year: 0, current_month: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<GearFilters>(EMPTY_GEAR_FILTERS);
  const [groupBy, setGroupBy] = useState<GearGroupBy>('brak');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Gear | null>(null);
  const [form, setForm] = useState<GearInput>(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, stats] = await Promise.all([getGear(), getGearStats()]);
      setAllItems(data);
      setTotals(stats.totals);
      setStatsMap(new Map(stats.items.map((i) => [i.gear_id, i])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => filterGear(allItems, filters), [allItems, filters]);
  const groupedItems = useMemo(
    () => groupGear(filteredItems, groupBy),
    [filteredItems, groupBy]
  );
  const sortedCategories = useMemo(
    () => [...GEAR_CATEGORIES].sort((a, b) => a.value.localeCompare(b.value, 'pl')),
    []
  );

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(item: Gear) {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      season: item.season,
      brand: item.brand ?? '',
      weight_g: item.weight_g,
      price: item.price,
      purchase_date: item.purchase_date,
      notes: item.notes ?? '',
    });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormError('');
  }

  function validateForm(): string | null {
    if (!form.name.trim()) return 'Nazwa jest wymagana';
    if (!form.category) return 'Kategoria jest wymagana';
    if (!form.season) return 'Sezon jest wymagany';
    if (form.weight_g != null && form.weight_g <= 0) {
      return 'Waga musi być dodatnią liczbą';
    }
    if (form.price != null && form.price <= 0) {
      return 'Cena musi być dodatnią liczbą';
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

    const payload: GearInput = {
      name: form.name.trim(),
      category: form.category,
      season: form.season,
      brand: form.brand?.toString().trim() || null,
      weight_g: form.weight_g ? Number(form.weight_g) : null,
      price: form.price ? Number(form.price) : null,
      purchase_date: form.purchase_date?.toString().trim() || null,
      notes: form.notes?.toString().trim() || null,
    };

    try {
      if (editing) {
        await updateGear(editing.id, payload);
      } else {
        await createGear(payload);
      }
      closeForm();
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Błąd zapisu');
    }
  }

  async function handleDelete() {
    if (deleteId === null) return;
    try {
      await deleteGear(deleteId);
      setDeleteId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd usuwania');
      setDeleteId(null);
    }
  }

  async function handleDefaultToggle(item: Gear, isDefault: boolean) {
    const prev = allItems;
    setAllItems((list) =>
      list.map((g) => (g.id === item.id ? { ...g, is_default: isDefault } : g))
    );
    try {
      await patchGearDefault(item.id, isDefault);
    } catch (e) {
      setAllItems(prev);
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    }
  }

  const statsLoaded = useMemo(() => statsMap.size > 0 || !loading, [statsMap.size, loading]);

  async function handleCopyMarkdown() {
    const markdown = copyGearToMarkdown(filteredItems, statsMap);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Nie udało się skopiować do schowka');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sprzęt</h1>
          <p className="text-muted">
            {filteredItems.length} z {allItems.length} elementów
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          <Plus size={18} />
          Dodaj sprzęt
        </button>
      </div>

      {statsLoaded && (
        <div className="stats-trivia">
          <div className="stats-trivia-item">
            <p className="label">Wydatki ogółem</p>
            <p className="value">{formatPln(totals.all_time)}</p>
          </div>
          <div className="stats-trivia-item">
            <p className="label">W tym roku</p>
            <p className="value">{formatPln(totals.current_year)}</p>
          </div>
          <div className="stats-trivia-item">
            <p className="label">W tym miesiącu</p>
            <p className="value">{formatPln(totals.current_month)}</p>
          </div>
        </div>
      )}

      <GearFiltersBar
        filters={filters}
        groupBy={groupBy}
        allItems={allItems}
        onFiltersChange={setFilters}
        onGroupByChange={setGroupBy}
        onCopyMarkdown={handleCopyMarkdown}
        copied={copied}
        copyDisabled={loading || filteredItems.length === 0}
      />

      <div className="gear-main">
        <div className="gear-main-toolbar">
            <div className="view-toggle">
              <button
                type="button"
                className={viewMode === 'grid' ? 'btn-icon active' : 'btn-icon'}
                onClick={() => setViewMode('grid')}
                aria-label="Widok siatki"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                className={viewMode === 'list' ? 'btn-icon active' : 'btn-icon'}
                onClick={() => setViewMode('list')}
                aria-label="Widok listy"
              >
                <List size={18} />
              </button>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}
          {loading && <p className="text-muted">Ładowanie...</p>}

          {!loading && filteredItems.length === 0 && (
            <p className="text-muted empty-state">Brak sprzętu pasującego do filtrów.</p>
          )}

          {!loading &&
            groupedItems.map((group) => (
              <section key={group.section || 'all'} className="gear-section">
                {group.section && <h2 className="gear-section-title">{group.section}</h2>}
                <div className={viewMode === 'grid' ? 'gear-grid' : 'gear-list'}>
                  {group.items.map((item) => (
                    <GearCard
                      key={item.id}
                      item={item}
                      usage={statsMap.get(item.id)}
                      onEdit={openEdit}
                      onDelete={setDeleteId}
                      onDefaultToggle={handleDefaultToggle}
                    />
                  ))}
                </div>
              </section>
            ))}
      </div>

      {formOpen && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edytuj sprzęt' : 'Dodaj sprzęt'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Nazwa *</label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="category">Kategoria *</label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                >
                  {sortedCategories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="season">Sezon *</label>
                <select
                  id="season"
                  value={form.season}
                  onChange={(e) =>
                    setForm({ ...form, season: e.target.value as GearSeason })
                  }
                  required
                >
                  {GEAR_SEASONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="brand">Marka</label>
                <input
                  id="brand"
                  value={form.brand ?? ''}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="weight">Waga (g)</label>
                  <input
                    id="weight"
                    type="number"
                    min="1"
                    value={form.weight_g ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weight_g: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="price">Cena (PLN)</label>
                  <input
                    id="price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.price ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        price: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="purchase-date">Data zakupu</label>
                <input
                  id="purchase-date"
                  type="date"
                  value={form.purchase_date ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      purchase_date: e.target.value || null,
                    })
                  }
                />
              </div>
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

      {deleteId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Usuń sprzęt</h2>
            <p>Czy na pewno chcesz usunąć ten element?</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteId(null)}>
                Anuluj
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
