import { Check, Clipboard, RotateCcw } from 'lucide-react';
import { GEAR_CATEGORIES, GEAR_SEASONS } from '../../constants/gearCategories';
import {
  DEFAULT_GEAR_GROUP_BY,
  EMPTY_GEAR_FILTERS,
  type GearFilters,
  type GearGroupBy,
  getAllPriceBuckets,
  getAllWeightBuckets,
  getAvailablePurchaseDateSections,
  getPriceBucket,
  getWeightBucket,
  hasActiveGearViewState,
} from '../../lib/gearFilters';
import type { Gear } from '../../types/gear';

interface Props {
  filters: GearFilters;
  groupBy: GearGroupBy;
  allItems: Gear[];
  onFiltersChange: (filters: GearFilters) => void;
  onGroupByChange: (groupBy: GearGroupBy) => void;
  onCopyMarkdown: () => void;
  copied: boolean;
  copyDisabled: boolean;
}

export default function GearFiltersBar({
  filters,
  groupBy,
  allItems,
  onFiltersChange,
  onGroupByChange,
  onCopyMarkdown,
  copied,
  copyDisabled,
}: Props) {
  const { months, years } = getAvailablePurchaseDateSections(allItems);

  const priceBucketsWithItems = getAllPriceBuckets().filter((b) =>
    allItems.some((item) => getPriceBucket(item.price) === b)
  );

  const weightBucketsWithItems = getAllWeightBuckets().filter((b) =>
    allItems.some((item) => getWeightBucket(item.weight_g) === b)
  );

  const categoriesWithItems = GEAR_CATEGORIES.filter((c) =>
    allItems.some((item) => item.category === c.value)
  ).sort((a, b) => a.value.localeCompare(b.value, 'pl'));

  const viewActive = hasActiveGearViewState(filters, groupBy);

  function handleReset() {
    onFiltersChange(EMPTY_GEAR_FILTERS);
    onGroupByChange(DEFAULT_GEAR_GROUP_BY);
  }

  return (
    <div className="gear-filters-bar">
      <div className="gear-filters-toolbar gap-2">
        <button
          type="button"
          onClick={onCopyMarkdown}
          disabled={copyDisabled}
          className={`btn btn-ghost btn-sm gear-filters-reset${copied ? ' text-green-700' : ''}`}
        >
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          {copied ? 'Skopiowano!' : 'Kopiuj Markdown'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm gear-filters-reset"
          disabled={!viewActive}
          onClick={handleReset}
        >
          <RotateCcw size={14} />
          Wyczyść filtry
        </button>
      </div>
      <div className="gear-filters-row">
        <div className="gear-filter-field">
          <label htmlFor="gear-group-by">Grupuj według</label>
          <select
            id="gear-group-by"
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as GearGroupBy)}
          >
            <option value="brak">Brak</option>
            <option value="kategoria">Kategoria</option>
            <option value="cena">Cena</option>
            <option value="waga">Waga</option>
            <option value="data_zakupu">Data zakupu</option>
          </select>
        </div>

        <div className="gear-filter-field">
          <label htmlFor="gear-filter-season">Sezon</label>
          <select
            id="gear-filter-season"
            value={filters.season}
            onChange={(e) => onFiltersChange({ ...filters, season: e.target.value })}
          >
            <option value="">Wszystkie sezony</option>
            {GEAR_SEASONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {categoriesWithItems.length > 0 && (
          <div className="gear-filter-field">
            <label htmlFor="gear-filter-category">Kategoria</label>
            <select
              id="gear-filter-category"
              value={filters.category}
              onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
            >
              <option value="">Wszystkie kategorie</option>
              {categoriesWithItems.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value}
                </option>
              ))}
            </select>
          </div>
        )}

        {priceBucketsWithItems.length > 0 && (
          <div className="gear-filter-field">
            <label htmlFor="gear-filter-price">Cena</label>
            <select
              id="gear-filter-price"
              value={filters.priceBucket}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  priceBucket: e.target.value as GearFilters['priceBucket'],
                })
              }
            >
              <option value="">Wszystkie ceny</option>
              {priceBucketsWithItems.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {weightBucketsWithItems.length > 0 && (
          <div className="gear-filter-field">
            <label htmlFor="gear-filter-weight">Waga</label>
            <select
              id="gear-filter-weight"
              value={filters.weightBucket}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  weightBucket: e.target.value as GearFilters['weightBucket'],
                })
              }
            >
              <option value="">Wszystkie wagi</option>
              {weightBucketsWithItems.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {(months.length > 0 || years.length > 0) && (
          <div className="gear-filter-field">
            <label htmlFor="gear-filter-purchase-date">Data zakupu</label>
            <select
              id="gear-filter-purchase-date"
              value={filters.purchaseDate}
              onChange={(e) => onFiltersChange({ ...filters, purchaseDate: e.target.value })}
            >
              <option value="">Wszystkie daty</option>
              {months.length > 0 && (
                <optgroup label="Miesiące">
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
              )}
              {years.length > 0 && (
                <optgroup label="Lata">
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
