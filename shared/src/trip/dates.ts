export const UNKNOWN_TRIP_DATE = 'nieznana';

export function isUnknownTripDate(value: string): boolean {
  return value === UNKNOWN_TRIP_DATE;
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function isValidTripDate(value: string): boolean {
  return isUnknownTripDate(value) || isValidIsoDate(value);
}
