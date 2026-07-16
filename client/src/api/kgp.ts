import type { KgpPeak } from '../types/trip';
import { apiFetch, handleResponse } from './client';

export interface KgpTrackerTrip {
  id: number;
  name: string;
}

export interface KgpTrackerPeak extends KgpPeak {
  kgp_url?: string | null;
  conquer_count: number;
  conquer_order: number | null;
  first_conquered_at: string | null;
  trips: KgpTrackerTrip[];
}

export interface KgpTrackerData {
  progress: { conquered: number; total: number };
  peaks: KgpTrackerPeak[];
}

export async function getKgpPeaks(): Promise<KgpPeak[]> {
  const res = await apiFetch('/api/kgp');
  return handleResponse<KgpPeak[]>(res);
}

export async function getKgpTracker(): Promise<KgpTrackerData> {
  const res = await apiFetch('/api/kgp/tracker');
  return handleResponse<KgpTrackerData>(res);
}
