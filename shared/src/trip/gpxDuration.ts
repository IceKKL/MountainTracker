import type { DurationField, GpxParseResult, TripStatus } from './types.js';

export function resolveGpxDurationForTrip(
  tripStatus: TripStatus,
  parsed: Pick<GpxParseResult, 'duration_min' | 'duration_estimated'>
): {
  duration_field: DurationField | null;
  duration_min: number | null;
  duration_estimated: boolean;
} {
  if (parsed.duration_min == null) {
    return { duration_field: null, duration_min: null, duration_estimated: false };
  }

  if (tripStatus === 'planowana') {
    return {
      duration_field: 'estimated_duration_min',
      duration_min: parsed.duration_min,
      duration_estimated: parsed.duration_estimated,
    };
  }

  return {
    duration_field: 'actual_duration_min',
    duration_min: parsed.duration_min,
    duration_estimated: parsed.duration_estimated,
  };
}
