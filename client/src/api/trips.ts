import type {
  GpxData,
  OpenMeteoResponse,
  Trip,
  TripDetail,
  TripInput,
  TripLogisticsResponse,
  TripPackingItem,
  TripPhoto,
  TripRatingsResponse,
  TripParticipantStatus,
  TripParticipantsResponse,
} from '../types/trip';
import { tripSlug } from '../utils/slugify';
import { apiFetch, handleResponse } from './client';

export type TripRef = Pick<Trip, 'id' | 'name'>;

type TripSlugInput = string | TripRef;

function resolveSlug(ref: TripSlugInput): string {
  return typeof ref === 'string' ? ref : tripSlug(ref.id, ref.name);
}

export async function getTrips(filters?: { status?: string }): Promise<Trip[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  const res = await apiFetch(`/api/trips${qs ? `?${qs}` : ''}`);
  return handleResponse<Trip[]>(res);
}

export async function getTrip(idSlug: string): Promise<TripDetail> {
  const res = await apiFetch(`/api/trips/${idSlug}`);
  return handleResponse<TripDetail>(res);
}

export function tripUploadUrl(trip: TripRef, filename: string): string {
  return `/uploads/trips/${tripSlug(trip.id, trip.name)}/${filename}`;
}

export async function getTripPhotos(ref: TripSlugInput): Promise<TripPhoto[]> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/photos`);
  return handleResponse<TripPhoto[]>(res);
}

export async function uploadTripPhotos(ref: TripSlugInput, files: File[]): Promise<TripPhoto[]> {
  const form = new FormData();
  for (const file of files) form.append('photos', file);
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/photos`, { method: 'POST', body: form });
  return handleResponse<TripPhoto[]>(res);
}

export async function deleteTripPhoto(ref: TripSlugInput, photoId: number): Promise<void> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/photos/${photoId}`, { method: 'DELETE' });
  await handleResponse(res);
}

export async function uploadTripGpx(ref: TripSlugInput, file: File): Promise<GpxData> {
  const form = new FormData();
  form.append('gpx', file);
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/gpx`, { method: 'POST', body: form });
  return handleResponse<GpxData>(res);
}

export interface FitUploadResult {
  fit_filename: string | null;
  actual_duration_min: number | null;
  total_calories: number | null;
  total_water_ml: number | null;
}

export async function uploadTripFit(ref: TripSlugInput, file: File): Promise<FitUploadResult> {
  const form = new FormData();
  form.append('fit', file);
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/fit`, { method: 'POST', body: form });
  return handleResponse<FitUploadResult>(res);
}

export async function getTripGpxData(ref: TripSlugInput): Promise<GpxData> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/gpx-data`);
  return handleResponse<GpxData>(res);
}

export async function getTripLogistics(ref: TripSlugInput): Promise<TripLogisticsResponse> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/logistics`);
  return handleResponse<TripLogisticsResponse>(res);
}

export async function createTrip(input: TripInput): Promise<Trip> {
  const res = await apiFetch('/api/trips', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse<Trip>(res);
}

export async function updateTrip(ref: TripSlugInput, input: TripInput): Promise<Trip> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return handleResponse<Trip>(res);
}

export async function deleteTrip(ref: TripSlugInput): Promise<void> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}`, { method: 'DELETE' });
  await handleResponse(res);
}

export async function fetchTripForecast(ref: TripSlugInput): Promise<OpenMeteoResponse> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/forecast`);
  return handleResponse<OpenMeteoResponse>(res);
}

export function formatWeatherForDate(
  weather: OpenMeteoResponse | null,
  date: string
): string | null {
  if (!weather?.daily) return null;
  const idx = weather.daily.time.indexOf(date);
  if (idx === -1) return null;
  const min = weather.daily.temperature_2m_min[idx];
  const max = weather.daily.temperature_2m_max[idx];
  const precip = weather.daily.precipitation_sum[idx];
  const wind = weather.daily.wind_speed_10m_max?.[idx];
  const windPart = wind != null ? `, wiatr: ${wind} km/h` : '';
  return `${min}°C – ${max}°C, opady: ${precip} mm${windPart}`;
}

export { computeAverage } from '@mountain-tracker/shared';

export async function getTripPacking(
  ref: TripSlugInput,
  options?: { shared?: boolean }
): Promise<TripPackingItem[]> {
  const shared = options?.shared ? '?shared=1' : '';
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/packing${shared}`);
  return handleResponse<TripPackingItem[]>(res);
}

export async function patchTripPacking(
  ref: TripSlugInput,
  gearId: number,
  update: {
    packed?: boolean;
    is_packed?: boolean;
    is_worn?: boolean;
    assigned_user_id?: number | null;
  }
): Promise<TripPackingItem> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/packing/${gearId}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
  return handleResponse<TripPackingItem>(res);
}

export async function setTripPacked(
  ref: TripSlugInput,
  gearId: number,
  packed: boolean
): Promise<TripPackingItem> {
  return patchTripPacking(ref, gearId, { is_packed: packed });
}

export async function setTripWorn(
  ref: TripSlugInput,
  gearId: number,
  is_worn: boolean
): Promise<TripPackingItem> {
  return patchTripPacking(ref, gearId, { is_worn });
}

export async function addTripGear(
  ref: TripSlugInput,
  gearId: number,
  options?: { assigned_user_id?: number; is_shared?: boolean }
): Promise<TripPackingItem> {
  const body: { assigned_user_id?: number; is_shared?: boolean } = {};
  if (options?.assigned_user_id != null) body.assigned_user_id = options.assigned_user_id;
  if (options?.is_shared) body.is_shared = true;
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/gear/${gearId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return handleResponse<TripPackingItem>(res);
}

export async function removeTripGear(ref: TripSlugInput, gearId: number): Promise<void> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/gear/${gearId}`, { method: 'DELETE' });
  await handleResponse(res);
}

export async function getTripRatings(ref: TripSlugInput): Promise<TripRatingsResponse> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/ratings`);
  return handleResponse<TripRatingsResponse>(res);
}

export async function upsertTripRating(
  ref: TripSlugInput,
  category: string,
  score: number
): Promise<TripRatingsResponse> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/ratings`, {
    method: 'PUT',
    body: JSON.stringify({ category, score }),
  });
  return handleResponse<TripRatingsResponse>(res);
}

export async function deleteTripRating(
  ref: TripSlugInput,
  category: string
): Promise<TripRatingsResponse> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/ratings/${encodeURIComponent(category)}`, {
    method: 'DELETE',
  });
  return handleResponse<TripRatingsResponse>(res);
}

export async function getTripParticipants(ref: TripSlugInput): Promise<TripParticipantsResponse> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/participants`);
  return handleResponse<TripParticipantsResponse>(res);
}

export async function respondTrip(
  ref: TripSlugInput,
  status: TripParticipantStatus
): Promise<void> {
  const res = await apiFetch(`/api/trips/${resolveSlug(ref)}/respond`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  await handleResponse(res);
}

export function parseStoredWeather(json: string | null): OpenMeteoResponse | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as OpenMeteoResponse;
  } catch {
    return null;
  }
}

export function parseGpxProfile(json: string | null | undefined): [number, number][] | null {
  if (!json) return null;
  try {
    const cache = JSON.parse(json) as { track?: [number, number][] };
    if (cache.track && cache.track.length >= 2) return cache.track;
  } catch {
    return null;
  }
  return null;
}
