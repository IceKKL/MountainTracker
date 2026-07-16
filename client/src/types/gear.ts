export type GearSeason = 'lato' | 'zima' | 'uniwersalny';

export interface Gear {
  id: number;
  name: string;
  category: string;
  season: GearSeason;
  brand: string | null;
  weight_g: number | null;
  price: number | null;
  purchase_date: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
}

export interface GearInput {
  name: string;
  category: string;
  season: GearSeason;
  brand?: string | null;
  weight_g?: number | null;
  price?: number | null;
  purchase_date?: string | null;
  notes?: string | null;
  is_default?: boolean;
}

export interface GearStatsItem {
  gear_id: number;
  name: string;
  price: number | null;
  total_km: number;
  trip_count: number;
  cost_per_km: number | null;
  cost_per_trip: number | null;
}

export interface GearStatsResponse {
  totals: {
    all_time: number;
    current_year: number;
    current_month: number;
  };
  items: GearStatsItem[];
}
