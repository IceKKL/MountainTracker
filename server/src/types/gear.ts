export const GEAR_CATEGORIES = [
  'Kurtka / Softshell',
  'Koszulka',
  'Spodnie',
  'Bielizna termiczna',
  'Polar',
  'Skarpety',
  'Buty',
  'Czapka / Buff / Kask',
  'Rękawice',
  'Plecak',
  'Kijki',
  'Raki / sprzęt techniczny',
  'Czołówka',
  'Filtr do wody',
  'Apteczka / bezpieczeństwo',
  'Codzienne',
  'Inne',
] as const;

export const GEAR_SEASONS = ['lato', 'zima', 'uniwersalny'] as const;

export type GearCategory = (typeof GEAR_CATEGORIES)[number];
export type GearSeason = (typeof GEAR_SEASONS)[number];

export interface Gear {
  id: number;
  name: string;
  category: GearCategory;
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
  category: GearCategory;
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
