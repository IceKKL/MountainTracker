import type { Gear, GearInput, GearStatsResponse } from '../types/gear';
import { apiFetch, handleResponse } from './client';

export async function getGear(filters?: {
  category?: string;
  season?: string;
}): Promise<Gear[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.season) params.set('season', filters.season);
  const qs = params.toString();
  const res = await apiFetch(`/api/gear${qs ? `?${qs}` : ''}`);
  return handleResponse<Gear[]>(res);
}

export async function getGearStats(): Promise<GearStatsResponse> {
  const res = await apiFetch('/api/gear/stats');
  return handleResponse<GearStatsResponse>(res);
}

export async function createGear(input: GearInput): Promise<Gear> {
  const res = await apiFetch('/api/gear', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return handleResponse<Gear>(res);
}

export async function updateGear(id: number, input: GearInput): Promise<Gear> {
  const res = await apiFetch(`/api/gear/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return handleResponse<Gear>(res);
}

export async function patchGearDefault(id: number, isDefault: boolean): Promise<Gear> {
  const res = await apiFetch(`/api/gear/${id}/default`, {
    method: 'PATCH',
    body: JSON.stringify({ is_default: isDefault }),
  });
  return handleResponse<Gear>(res);
}

export async function deleteGear(id: number): Promise<void> {
  const res = await apiFetch(`/api/gear/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}
