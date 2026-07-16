import type { OpenMeteoResponse, Trip } from '../types/trip';
import type { GroupMember } from '../api/groups';
import { apiFetch, handleResponse } from './client';

export interface ActivityPeriodStats {
  distance_km: number;
  elevation_gain_m: number;
  duration_min: number;
}

export interface DashboardData {
  kgp_progress: { conquered: number; total: number };
  activity_stats: {
    month: ActivityPeriodStats;
    year: ActivityPeriodStats;
  };
  next_trip: Trip | null;
  next_trip_group: { id: number; name: string; member_count: number } | null;
  next_trip_weather: OpenMeteoResponse | null;
  next_trip_packing: { packed: number; total: number } | null;
  planned_unknown_date_count: number;
  last_completed_trip: Trip | null;
  last_trip_companions: GroupMember[];
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await apiFetch('/api/dashboard');
  return handleResponse<DashboardData>(res);
}
