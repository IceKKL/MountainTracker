import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Backpack,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Share2,
  Shirt,
  Trash2,
  Zap,
} from 'lucide-react';
import type { GroupMember } from '@mountain-tracker/shared';
import { getGear } from '../../api/gear';
import { getGroupMembers } from '../../api/groups';
import {
  addTripGear,
  getTripPacking,
  patchTripPacking,
  removeTripGear,
  type TripRef,
} from '../../api/trips';
import { GEAR_CATEGORIES, getCategoryIcon } from '../../constants/gearCategories';
import { useAuth } from '../../context/AuthContext';
import type { Gear } from '../../types/gear';
import type { TripPackingItem, TripStatus } from '../../types/trip';

interface Props {
  trip: TripRef;
  groupId: number;
  status: TripStatus;
  onPackingChange?: () => void;
}

export default function TripSharedPackingSection({
  trip,
  groupId,
  status,
  onPackingChange,
}: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<TripPackingItem[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [allGear, setAllGear] = useState<Gear[]>([]);
  const [gearLoading, setGearLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [assignTo, setAssignTo] = useState<number | ''>('');
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [packing, groupMembers] = await Promise.all([
        getTripPacking(trip, { shared: true }),
        getGroupMembers(groupId),
      ]);
      setItems(packing);
      setMembers(groupMembers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania sprzętu wspólnego');
    } finally {
      setLoading(false);
    }
  }, [trip, groupId]);

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
    setAssignTo('');
    setGearLoading(true);
    try {
      setAllGear(await getGear());
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
    setAssignTo('');
  }

  function canToggleItem(item: TripPackingItem): boolean {
    if (!user) return false;
    return item.assigned_user_id == null || item.assigned_user_id === user.id;
  }

  async function handleToggleWorn(item: TripPackingItem, is_worn: boolean) {
    if (!canToggleItem(item)) return;
    const prev = items;
    setItems((list) => list.map((i) => (i.gear_id === item.gear_id ? { ...i, is_worn } : i)));
    try {
      await patchTripPacking(trip, item.gear_id, { is_worn });
      onPackingChange?.();
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    }
  }

  async function handleToggle(item: TripPackingItem, packed: boolean) {
    if (!user || !canToggleItem(item)) return;

    const member = members.find((m) => m.id === user.id);
    const assigned_user_id = packed ? user.id : null;
    const prev = items;
    setItems((list) =>
      list.map((i) =>
        i.gear_id === item.gear_id
          ? {
              ...i,
              packed,
              is_packed: packed,
              assigned_user_id,
              assigned_username: packed ? (member?.username ?? null) : null,
              assigned_name: packed ? (member?.name ?? null) : null,
            }
          : i
      )
    );
    try {
      const updated = await patchTripPacking(trip, item.gear_id, {
        is_packed: packed,
        assigned_user_id,
      });
      setItems((list) => list.map((i) => (i.gear_id === item.gear_id ? updated : i)));
      onPackingChange?.();
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    }
  }

  async function handleAssigneeChange(item: TripPackingItem, userId: number) {
    const prev = item.assigned_user_id;
    const member = members.find((m) => m.id === userId);
    setItems((list) =>
      list.map((i) =>
        i.gear_id === item.gear_id
          ? {
              ...i,
              assigned_user_id: userId,
              assigned_username: member?.username ?? null,
              assigned_name: member?.name ?? null,
            }
          : i
      )
    );
    try {
      const updated = await patchTripPacking(trip, item.gear_id, { assigned_user_id: userId });
      setItems((list) => list.map((i) => (i.gear_id === item.gear_id ? updated : i)));
    } catch (e) {
      setItems((list) =>
        list.map((i) =>
          i.gear_id === item.gear_id ? { ...i, assigned_user_id: prev } : i
        )
      );
      setError(e instanceof Error ? e.message : 'Błąd przypisania');
    }
  }

  async function handleAdd(gear: Gear) {
    try {
      const options: { is_shared: boolean; assigned_user_id?: number } = { is_shared: true };
      if (assignTo !== '') options.assigned_user_id = assignTo;
      const added = await addTripGear(trip, gear.id, options);
      setItems((list) => [...list, added]);
      closeAddModal();
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
            Zwiń sprzęt wspólny
          </>
        ) : (
          <>
            <ChevronDown size={16} />
            Rozwiń sprzęt wspólny
          </>
        )}
      </button>
    );
  }

  return (
    <section className="trip-details-section card packing-section h-full">
      <div className="section-header">
        <h2>
          <Share2 size={18} />
          Sprzęt wspólny
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
            aria-label="Dodaj sprzęt wspólny"
            title="Dodaj sprzęt wspólny"
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
              <span>Cały sprzęt wspólny spakowany</span>
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
          Brak sprzętu wspólnego. Kliknij <strong>+</strong>, aby dodać elementy dzielone
          między członków grupy.
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
                      {catItems.map((item) => {
                        const toggleable = canToggleItem(item);
                        return (
                        <li key={item.gear_id} className="packing-item">
                          <label className={`packing-label ${!toggleable ? 'opacity-60' : ''}`}>
                            <input
                              type="checkbox"
                              checked={item.packed}
                              disabled={!toggleable}
                              onChange={(e) => handleToggle(item, e.target.checked)}
                              title={
                                !toggleable
                                  ? `Przypisane do ${item.assigned_name ?? 'innej osoby'}`
                                  : undefined
                              }
                            />
                            <span className="packing-name">{item.name}</span>
                          </label>
                          <div className="packing-item-actions">
                            <select
                              value={item.assigned_user_id ?? ''}
                              onChange={(e) =>
                                handleAssigneeChange(item, Number(e.target.value))
                              }
                              className="rounded-[8px] border border-[var(--border)] bg-white px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                              aria-label={`Przypisz ${item.name}`}
                            >
                              <option value="" disabled>
                                {item.assigned_user_id == null ? 'Nieprzypisane' : 'Przypisz do…'}
                              </option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={`packing-worn-toggle ${item.is_worn ? 'packing-worn-toggle-on' : ''}`}
                              disabled={!toggleable}
                              onClick={() => handleToggleWorn(item, !item.is_worn)}
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
                              aria-label={`Usuń ${item.name}`}
                              title="Usuń"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </li>
                        );
                      })}
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
              <h2>Dodaj sprzęt wspólny</h2>

              <label className="mb-4 flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
                Przypisz do
                <select
                  value={assignTo}
                  onChange={(e) =>
                    setAssignTo(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-base font-normal text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="">Nieprzypisane (domyślnie)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (@{m.username})
                    </option>
                  ))}
                </select>
              </label>

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
