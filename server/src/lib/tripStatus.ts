import type { TripStatus } from '../types/trip.js';
import { isUnknownTripDate } from '@mountain-tracker/shared';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultStatusFromDate(dateStart: string): TripStatus {
  if (isUnknownTripDate(dateStart)) return 'planowana';
  return dateStart < todayIso() ? 'zrealizowana' : 'planowana';
}

export function resolveStatusForCreate(
  dateStart: string,
  explicitStatus?: TripStatus
): TripStatus {
  if (explicitStatus) return explicitStatus;
  return defaultStatusFromDate(dateStart);
}

export function resolveStatusForUpdate(
  existingStatus: TripStatus,
  explicitStatus?: TripStatus
): TripStatus {
  if (explicitStatus) return explicitStatus;
  return existingStatus;
}
