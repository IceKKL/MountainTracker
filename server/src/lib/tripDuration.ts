import type { TripStatus } from '@mountain-tracker/shared';
import type { Trip } from '../types/trip.js';

export function resolveDurationsForStatus(
  trip: Pick<Trip, 'gpx_filename' | 'fit_filename'>,
  status: TripStatus,
  estimated_duration_min: number | null,
  actual_duration_min: number | null
): { estimated_duration_min: number | null; actual_duration_min: number | null } {
  if (
    status === 'zrealizowana' &&
    actual_duration_min == null &&
    estimated_duration_min != null &&
    !trip.gpx_filename &&
    !trip.fit_filename
  ) {
    return { estimated_duration_min, actual_duration_min: estimated_duration_min };
  }
  return { estimated_duration_min, actual_duration_min };
}
