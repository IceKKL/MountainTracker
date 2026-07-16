import { GEAR_CATEGORIES } from '../constants/gearCategories';
import type { Gear } from '../types/gear';

export type GearGroupBy = 'brak' | 'kategoria' | 'cena' | 'waga' | 'data_zakupu';

export type PriceBucket = '< 50 zł' | '< 100 zł' | '< 500 zł' | '500+ zł' | 'Bez ceny';
export type WeightBucket = '< 100 g' | '< 500 g' | '500–1000 g' | '1000+ g' | 'Bez wagi';

export interface GearFilters {
  category: string;
  season: string;
  priceBucket: PriceBucket | '';
  weightBucket: WeightBucket | '';
  purchaseDate: string;
}

export const EMPTY_GEAR_FILTERS: GearFilters = {
  category: '',
  season: '',
  priceBucket: '',
  weightBucket: '',
  purchaseDate: '',
};

export function hasActiveFilters(filters: GearFilters): boolean {
  return !!(
    filters.category ||
    filters.season ||
    filters.priceBucket ||
    filters.weightBucket ||
    filters.purchaseDate
  );
}

export const DEFAULT_GEAR_GROUP_BY: GearGroupBy = 'brak';

export function hasActiveGearViewState(filters: GearFilters, groupBy: GearGroupBy): boolean {
  return hasActiveFilters(filters) || groupBy !== DEFAULT_GEAR_GROUP_BY;
}

const MONTH_NAMES = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

const NO_PURCHASE_DATE = 'Bez daty zakupu';

function parsePurchaseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getPriceBucket(price: number | null): PriceBucket {
  if (price == null || price <= 0) return 'Bez ceny';
  if (price < 50) return '< 50 zł';
  if (price < 100) return '< 100 zł';
  if (price < 500) return '< 500 zł';
  return '500+ zł';
}

export function getWeightBucket(weight: number | null): WeightBucket {
  if (weight == null || weight <= 0) return 'Bez wagi';
  if (weight < 100) return '< 100 g';
  if (weight < 500) return '< 500 g';
  if (weight <= 1000) return '500–1000 g';
  return '1000+ g';
}

export function getPurchaseDateSectionKey(purchaseDate: string | null): string {
  if (!purchaseDate) return NO_PURCHASE_DATE;
  const date = parsePurchaseDate(purchaseDate);
  if (!date) return NO_PURCHASE_DATE;

  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return MONTH_NAMES[date.getMonth()];
  }
  return String(date.getFullYear());
}

export function getPurchaseDateSortKey(section: string): number {
  if (section === NO_PURCHASE_DATE) return Number.MAX_SAFE_INTEGER;
  const monthIdx = MONTH_NAMES.indexOf(section);
  if (monthIdx >= 0) {
    const now = new Date();
    return now.getFullYear() * 100 + (12 - monthIdx);
  }
  return (10000 - parseInt(section, 10)) * 100;
}

const PRICE_BUCKET_ORDER: PriceBucket[] = ['< 50 zł', '< 100 zł', '< 500 zł', '500+ zł', 'Bez ceny'];
const PRICE_GROUP_ORDER: PriceBucket[] = ['500+ zł', '< 500 zł', '< 100 zł', '< 50 zł', 'Bez ceny'];
const WEIGHT_BUCKET_ORDER: WeightBucket[] = [
  '< 100 g',
  '< 500 g',
  '500–1000 g',
  '1000+ g',
  'Bez wagi',
];
const WEIGHT_GROUP_ORDER: WeightBucket[] = [
  '1000+ g',
  '500–1000 g',
  '< 500 g',
  '< 100 g',
  'Bez wagi',
];

export function getAllPriceBuckets(): PriceBucket[] {
  return PRICE_BUCKET_ORDER;
}

export function getAllWeightBuckets(): WeightBucket[] {
  return WEIGHT_BUCKET_ORDER;
}

export function getAvailablePurchaseDateSections(items: Gear[]): {
  months: string[];
  years: string[];
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  const months = new Set<string>();
  const years = new Set<string>();

  for (const item of items) {
    if (!item.purchase_date) continue;
    const date = parsePurchaseDate(item.purchase_date);
    if (!date) continue;

    if (date.getFullYear() === currentYear) {
      months.add(MONTH_NAMES[date.getMonth()]);
    } else {
      years.add(String(date.getFullYear()));
    }
  }

  const sortedMonths = [...months].sort(
    (a, b) => getPurchaseDateSortKey(b) - getPurchaseDateSortKey(a)
  );
  const sortedYears = [...years].sort((a, b) => Number(b) - Number(a));
  return { months: sortedMonths, years: sortedYears };
}

function matchesPurchaseDateFilter(item: Gear, purchaseDate: string): boolean {
  if (!purchaseDate) return true;
  if (!item.purchase_date) return false;
  return getPurchaseDateSectionKey(item.purchase_date) === purchaseDate;
}

export function filterGear(items: Gear[], filters: GearFilters): Gear[] {
  return items.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.season && item.season !== filters.season) return false;
    if (filters.priceBucket && getPriceBucket(item.price) !== filters.priceBucket) return false;
    if (filters.weightBucket && getWeightBucket(item.weight_g) !== filters.weightBucket) {
      return false;
    }
    if (!matchesPurchaseDateFilter(item, filters.purchaseDate)) return false;
    return true;
  });
}

function getGroupKey(item: Gear, groupBy: GearGroupBy): string {
  switch (groupBy) {
    case 'kategoria':
      return item.category;
    case 'cena':
      return getPriceBucket(item.price);
    case 'waga':
      return getWeightBucket(item.weight_g);
    case 'data_zakupu':
      return getPurchaseDateSectionKey(item.purchase_date);
    default:
      return '';
  }
}

function getPurchaseDateSectionOrder(section: string): number {
  if (section === NO_PURCHASE_DATE) return Number.MAX_SAFE_INTEGER;

  const monthIdx = MONTH_NAMES.indexOf(section);
  if (monthIdx >= 0) {
    const year = new Date().getFullYear();
    return -(year * 12 + monthIdx);
  }

  const year = parseInt(section, 10);
  if (Number.isNaN(year)) return Number.MAX_SAFE_INTEGER - 1;
  return -(year * 12 + 11);
}

function getSectionOrder(groupBy: GearGroupBy, section: string): number {
  if (groupBy === 'kategoria') {
    const idx = GEAR_CATEGORIES.findIndex((c) => c.value === section);
    return idx >= 0 ? idx : 999;
  }
  if (groupBy === 'cena') {
    const idx = PRICE_GROUP_ORDER.indexOf(section as PriceBucket);
    return idx >= 0 ? idx : 998;
  }
  if (groupBy === 'waga') {
    const idx = WEIGHT_GROUP_ORDER.indexOf(section as WeightBucket);
    return idx >= 0 ? idx : 998;
  }
  return getPurchaseDateSectionOrder(section);
}

function sortByPriceDesc(a: Gear, b: Gear): number {
  const aPrice = a.price != null && a.price > 0 ? a.price : -1;
  const bPrice = b.price != null && b.price > 0 ? b.price : -1;
  return bPrice - aPrice || b.created_at.localeCompare(a.created_at);
}

function sortByWeightDesc(a: Gear, b: Gear): number {
  const aWeight = a.weight_g != null && a.weight_g > 0 ? a.weight_g : -1;
  const bWeight = b.weight_g != null && b.weight_g > 0 ? b.weight_g : -1;
  return bWeight - aWeight || b.created_at.localeCompare(a.created_at);
}

function sortByPurchaseDateDesc(a: Gear, b: Gear): number {
  const aDate = a.purchase_date ?? '';
  const bDate = b.purchase_date ?? '';
  return bDate.localeCompare(aDate) || b.created_at.localeCompare(a.created_at);
}

export interface GearGroup {
  section: string;
  items: Gear[];
}

export function groupGear(items: Gear[], groupBy: GearGroupBy): GearGroup[] {
  if (groupBy === 'brak') {
    return [
      {
        section: '',
        items: [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      },
    ];
  }

  const map = new Map<string, Gear[]>();
  for (const item of items) {
    const key = getGroupKey(item, groupBy);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  const sortItems = (groupItems: Gear[]): Gear[] => {
    const sorted = [...groupItems];
    switch (groupBy) {
      case 'cena':
        return sorted.sort(sortByPriceDesc);
      case 'waga':
        return sorted.sort(sortByWeightDesc);
      case 'data_zakupu':
        return sorted.sort(sortByPurchaseDateDesc);
      default:
        return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  };

  return [...map.entries()]
    .map(([section, groupItems]) => ({
      section,
      items: sortItems(groupItems),
    }))
    .sort((a, b) => getSectionOrder(groupBy, a.section) - getSectionOrder(groupBy, b.section));
}

export function getGroupByLabel(groupBy: GearGroupBy): string {
  switch (groupBy) {
    case 'brak':
      return 'Brak';
    case 'kategoria':
      return 'Kategoria';
    case 'cena':
      return 'Cena';
    case 'waga':
      return 'Waga';
    case 'data_zakupu':
      return 'Data zakupu';
  }
}
