export const TRIP_STATUSES = ['planowana', 'zrealizowana'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export interface Trip {
  id: number;
  name: string;
  kgp_peak_id: number | null;
  peak_name: string;
  lat: number | null;
  lon: number | null;
  date_start: string;
  date_end: string | null;
  status: TripStatus;
  notes: string | null;
  gpx_filename: string | null;
  route_distance_km: number | null;
  route_elevation_gain_m: number | null;
  estimated_duration_min: number | null;
  actual_duration_min: number | null;
  forecast_weather_json: string | null;
  official_weather_json: string | null;
  gpx_profile_json: string | null;
  fit_filename: string | null;
  fit_total_calories: number | null;
  fit_water_ml: number | null;
  water_start_ml: number;
  food_weight_g: number;
  user_id?: number | null;
  group_id?: number | null;
  is_owner?: boolean;
}

export interface TripPhoto {
  id: number;
  trip_id: number;
  filename: string;
  uploaded_at: string;
}

export type DurationField = 'actual_duration_min' | 'estimated_duration_min';

export interface GpxData {
  distance_km: number;
  elevation_gain_m: number;
  profile: [number, number][];
  track: [number, number][];
  duration_min?: number | null;
  duration_field?: DurationField | null;
  duration_estimated?: boolean;
}

export interface GpxParseResult {
  distance_km: number;
  elevation_gain_m: number;
  duration_min: number | null;
  duration_field: DurationField | null;
  duration_estimated: boolean;
  profile: [number, number][];
  track: [number, number][];
}

export interface GpxProfileCache {
  profile: [number, number][];
  track: [number, number][];
}

export interface TripPackingItem {
  gear_id: number;
  name: string;
  category: string;
  season: string;
  weight_g: number | null;
  packed: boolean;
  is_packed: boolean;
  is_worn: boolean;
  assigned_user_id?: number | null;
  assigned_username?: string | null;
  assigned_name?: string | null;
  is_shared?: boolean;
}

export interface TripLogisticsNutritionPlan {
  food_kcal: number;
  water_ml: number;
  water_on_trail_ml: number;
  food_weight_g: number;
}

export interface TripLogisticsNutritionActual {
  food_kcal: number;
  water_ml: number | null;
}

export interface TripLogisticsResponse {
  base_weight_g: number;
  worn_weight_g: number;
  water_start_ml: number;
  food_weight_g: number;
  total_pack_weight_g: number;
  temperature_c: number | null;
  duration_min: number | null;
  elevation_gain_m: number | null;
  needs_water_filter: boolean;
  has_water_filter: boolean;
  has_gpx_data: boolean;
  planned: TripLogisticsNutritionPlan | null;
  actual: TripLogisticsNutritionActual | null;
}

export interface TripRatingItem {
  category: string;
  score: number;
}

export interface TripRatingsResponse {
  ratings: TripRatingItem[];
  average: number | null;
}

export interface TripDetail extends Trip {
  photos: TripPhoto[];
}

export interface TripInput {
  name: string;
  kgp_peak_id?: number | null;
  peak_name: string;
  lat?: number | null;
  lon?: number | null;
  date_start: string;
  date_end?: string | null;
  status?: TripStatus;
  notes?: string | null;
  estimated_duration_min?: number | null;
  actual_duration_min?: number | null;
  water_start_ml?: number | null;
  food_weight_g?: number | null;
  group_id?: number | null;
}

export type TripParticipantStatus = 'joined' | 'declined';

export interface TripParticipant {
  trip_id: number;
  user_id: number;
  status: TripParticipantStatus;
  responded_at: string;
}

export interface TripRespondInput {
  status: TripParticipantStatus;
}

export interface KgpPeak {
  id: number;
  name: string;
  mountain_range: string;
  elevation_m: number;
  kgp_url?: string | null;
}

export interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  weathercode: number[];
  wind_speed_10m_max: number[];
}

export interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
}
