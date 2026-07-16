import { isUnknownTripDate } from '@mountain-tracker/shared';

export { UNKNOWN_TRIP_DATE, isUnknownTripDate } from '@mountain-tracker/shared';

export function formatDisplayDate(iso: string): string {
  if (isUnknownTripDate(iso)) return 'Nieznana';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

export function formatDisplayDateRange(start: string, end: string | null): string {
  if (isUnknownTripDate(start)) return 'Nieznana';
  if (!end || end === start) return formatDisplayDate(start);
  return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
}

export function compareTripDates(a: string, b: string, ascending: boolean): number {
  const aUnknown = isUnknownTripDate(a);
  const bUnknown = isUnknownTripDate(b);
  if (aUnknown && bUnknown) return 0;
  if (aUnknown) return 1;
  if (bUnknown) return -1;
  return ascending ? a.localeCompare(b) : b.localeCompare(a);
}
