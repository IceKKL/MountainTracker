export const UNKNOWN_TRIP_DATE = 'nieznana';
export function isUnknownTripDate(value) {
    return value === UNKNOWN_TRIP_DATE;
}
export function isValidIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
export function isValidTripDate(value) {
    return isUnknownTripDate(value) || isValidIsoDate(value);
}
