import { db } from '../db/index.js';

export type ActivityPeriod = 'month' | 'year';

export interface ActivityPeriodStats {
  distance_km: number;
  elevation_gain_m: number;
  duration_min: number;
}

function getDateFilter(period: ActivityPeriod): { sql: string; param: string } {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (period === 'month') {
    return { sql: 'substr(date_start, 1, 7) = ?', param: month };
  }
  return { sql: 'substr(date_start, 1, 4) = ?', param: year };
}

function roundActivityStats(row: {
  distance_km: number;
  elevation_gain_m: number;
  duration_min: number;
}): ActivityPeriodStats {
  return {
    distance_km: Math.round(row.distance_km * 100) / 100,
    elevation_gain_m: Math.round(row.elevation_gain_m),
    duration_min: Math.round(row.duration_min),
  };
}

export function getUserActivityStats(
  userId: number,
  period: ActivityPeriod
): ActivityPeriodStats {
  const { sql, param } = getDateFilter(period);
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(route_distance_km), 0) AS distance_km,
        COALESCE(SUM(route_elevation_gain_m), 0) AS elevation_gain_m,
        COALESCE(SUM(COALESCE(actual_duration_min, estimated_duration_min)), 0) AS duration_min
       FROM trip
       WHERE user_id = ? AND status = 'zrealizowana' AND ${sql}`
    )
    .get(userId, param) as ActivityPeriodStats;
  return roundActivityStats(row);
}

export function getGroupActivityStats(
  groupId: number,
  period: ActivityPeriod
): ActivityPeriodStats {
  const { sql, param } = getDateFilter(period);
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(t.route_distance_km), 0) AS distance_km,
        COALESCE(SUM(t.route_elevation_gain_m), 0) AS elevation_gain_m,
        COALESCE(SUM(COALESCE(t.actual_duration_min, t.estimated_duration_min)), 0) AS duration_min
       FROM trip t
       INNER JOIN group_members gm ON gm.user_id = t.user_id
       WHERE gm.group_id = ?
         AND t.status = 'zrealizowana'
         AND ${sql.replace('date_start', 't.date_start')}`
    )
    .get(groupId, param) as ActivityPeriodStats;
  return roundActivityStats(row);
}
