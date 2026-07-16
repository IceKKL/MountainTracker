import type Database from 'better-sqlite3';
import { isUnknownTripDate, estimateDurationMin } from '@mountain-tracker/shared';
import { extractMaxTempForDate, fetchArchive, fetchForecast } from './openMeteo.js';
import type {
  Trip,
  TripLogisticsNutritionActual,
  TripLogisticsNutritionPlan,
  TripLogisticsResponse,
} from '../types/trip.js';

const WATER_FILTER_CATEGORY = 'Filtr do wody';

function resolveDurationMin(trip: Trip): number | null {
  if (trip.status === 'planowana') {
    if (trip.estimated_duration_min != null) return trip.estimated_duration_min;
    if (trip.route_distance_km != null && trip.route_elevation_gain_m != null) {
      return estimateDurationMin(trip.route_distance_km, trip.route_elevation_gain_m);
    }
    return null;
  }

  if (trip.actual_duration_min != null) return trip.actual_duration_min;
  if (trip.estimated_duration_min != null) return trip.estimated_duration_min;
  if (trip.route_distance_km != null && trip.route_elevation_gain_m != null) {
    return estimateDurationMin(trip.route_distance_km, trip.route_elevation_gain_m);
  }
  return null;
}

async function resolveTemperature(trip: Trip): Promise<number | null> {
  if (trip.lat == null || trip.lon == null || isUnknownTripDate(trip.date_start)) return null;

  if (trip.status === 'zrealizowana' && trip.official_weather_json) {
    const temp = extractMaxTempForDate(JSON.parse(trip.official_weather_json), trip.date_start);
    if (temp != null) return temp;
  }

  if (trip.status === 'planowana' && trip.forecast_weather_json) {
    const temp = extractMaxTempForDate(JSON.parse(trip.forecast_weather_json), trip.date_start);
    if (temp != null) return temp;
  }

  try {
    if (trip.status === 'zrealizowana') {
      const weather = await fetchArchive(trip.lat, trip.lon, trip.date_start);
      return extractMaxTempForDate(weather, trip.date_start);
    }
    const weather = await fetchForecast(trip.lat, trip.lon);
    return extractMaxTempForDate(weather, trip.date_start);
  } catch {
    return null;
  }
}

function roundWaterMlUp(ml: number): number {
  return Math.ceil(ml / 50) * 50;
}

function computePlannedFoodKcal(durationMin: number, elevationGainM: number): number {
  const hours = durationMin / 60;
  return Math.round(hours * 240 + elevationGainM * 0.45);
}

function computePlannedWaterMl(durationMin: number, elevationGainM: number): number {
  const hours = durationMin / 60;
  return roundWaterMlUp(Math.round(hours * 200 + elevationGainM * 1.2));
}

function buildPlannedNutrition(
  durationMin: number,
  elevationGainM: number,
  waterStartMl: number
): TripLogisticsNutritionPlan {
  const water_ml = computePlannedWaterMl(durationMin, elevationGainM);
  const food_kcal = computePlannedFoodKcal(durationMin, elevationGainM);
  const food_weight_g = Math.round(food_kcal / 4);
  const water_on_trail_ml = Math.max(0, water_ml - waterStartMl);
  return { food_kcal, water_ml, water_on_trail_ml, food_weight_g };
}

function hasWaterFilter(db: Database.Database, tripId: number, userId: number): boolean {
  const row = db
    .prepare(
      `SELECT 1
       FROM gear g
       LEFT JOIN trip_gear_status tgs ON tgs.trip_id = ? AND tgs.gear_id = g.id
       WHERE g.user_id = ?
         AND g.category = ?
         AND COALESCE(tgs.is_shared, 0) = 0
         AND COALESCE(tgs.is_excluded, 0) = 0
         AND (g.is_default = 1 OR tgs.trip_id IS NOT NULL)
         AND COALESCE(tgs.packed, 0) = 1
       LIMIT 1`
    )
    .get(tripId, userId, WATER_FILTER_CATEGORY);
  return !!row;
}

function computePackedGearWeight(
  db: Database.Database,
  tripId: number,
  userId: number,
  worn: boolean
): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(g.weight_g), 0) AS total
       FROM gear g
       LEFT JOIN trip_gear_status tgs ON tgs.trip_id = ? AND tgs.gear_id = g.id
       WHERE g.user_id = ?
         AND COALESCE(tgs.is_shared, 0) = 0
         AND COALESCE(tgs.is_excluded, 0) = 0
         AND (g.is_default = 1 OR tgs.trip_id IS NOT NULL)
         AND COALESCE(tgs.packed, 0) = 1
         AND COALESCE(tgs.is_worn, 0) = ?
         AND g.weight_g IS NOT NULL`
    )
    .get(tripId, userId, worn ? 1 : 0) as { total: number };
  return row.total ?? 0;
}

function resolvePackFoodWeightG(
  trip: Trip,
  planned: TripLogisticsNutritionPlan | null
): number {
  if (trip.food_weight_g > 0) return trip.food_weight_g;
  if (planned) return planned.food_weight_g;
  return 0;
}

function buildActualNutrition(trip: Trip): TripLogisticsNutritionActual | null {
  if (trip.status !== 'zrealizowana' || trip.fit_total_calories == null) return null;

  const water_ml =
    trip.fit_water_ml != null && trip.fit_water_ml > 0
      ? roundWaterMlUp(trip.fit_water_ml)
      : null;

  return {
    food_kcal: trip.fit_total_calories,
    water_ml,
  };
}

export async function computeTripLogistics(
  db: Database.Database,
  trip: Trip,
  userId: number
): Promise<TripLogisticsResponse> {
  const water_start_ml = trip.water_start_ml ?? 2000;
  const base_weight_g = computePackedGearWeight(db, trip.id, userId, false);
  const worn_weight_g = computePackedGearWeight(db, trip.id, userId, true);
  const has_gpx_data =
    !!trip.gpx_filename &&
    trip.route_distance_km != null &&
    trip.route_elevation_gain_m != null;

  const duration_min = resolveDurationMin(trip);
  const elevation_gain_m = trip.route_elevation_gain_m;
  const has_water_filter = hasWaterFilter(db, trip.id, userId);
  const actual = buildActualNutrition(trip);

  let planned: TripLogisticsNutritionPlan | null = null;
  if (has_gpx_data && duration_min != null && elevation_gain_m != null) {
    planned = buildPlannedNutrition(duration_min, elevation_gain_m, water_start_ml);
  }

  const food_weight_g = resolvePackFoodWeightG(trip, planned);

  if (trip.status === 'planowana' && planned) {
    db.prepare('UPDATE trip SET food_weight_g = ? WHERE id = ?').run(planned.food_weight_g, trip.id);
  }

  const temperature_c =
    has_gpx_data && duration_min != null && elevation_gain_m != null
      ? await resolveTemperature(trip)
      : null;

  const needs_water_filter =
    planned != null && planned.water_on_trail_ml > 0 && !has_water_filter;

  return {
    base_weight_g,
    worn_weight_g,
    water_start_ml,
    food_weight_g,
    total_pack_weight_g: base_weight_g + water_start_ml + food_weight_g,
    temperature_c,
    duration_min,
    elevation_gain_m,
    needs_water_filter,
    has_water_filter,
    has_gpx_data,
    planned,
    actual,
  };
}
