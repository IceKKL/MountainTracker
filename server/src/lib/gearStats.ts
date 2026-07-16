import type Database from 'better-sqlite3';
import type { GearStatsItem, GearStatsResponse } from '../types/gear.js';

interface GearUsageRow {
  id: number;
  name: string;
  price: number | null;
  total_km: number;
  trip_count: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeGearStats(db: Database.Database, userId: number): GearStatsResponse {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allTime =
    (
      db
        .prepare('SELECT COALESCE(SUM(price), 0) AS total FROM gear WHERE user_id = ?')
        .get(userId) as { total: number }
    ).total ?? 0;

  const currentYear =
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(price), 0) AS total FROM gear
           WHERE user_id = ? AND purchase_date IS NOT NULL AND substr(purchase_date, 1, 4) = ?`
        )
        .get(userId, year) as { total: number }
    ).total ?? 0;

  const currentMonth =
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(price), 0) AS total FROM gear
           WHERE user_id = ? AND purchase_date IS NOT NULL AND substr(purchase_date, 1, 7) = ?`
        )
        .get(userId, month) as { total: number }
    ).total ?? 0;

  const rows = db
    .prepare(
      `SELECT g.id, g.name, g.price,
        COALESCE(SUM(t.route_distance_km), 0) AS total_km,
        COUNT(DISTINCT t.id) AS trip_count
       FROM gear g
       LEFT JOIN trip_gear_status tgs ON tgs.gear_id = g.id AND tgs.packed = 1 AND tgs.is_excluded = 0
       LEFT JOIN trip t ON t.id = tgs.trip_id
         AND t.status = 'zrealizowana'
         AND t.route_distance_km IS NOT NULL
         AND t.user_id = ?
       WHERE g.user_id = ?
       GROUP BY g.id
       ORDER BY g.name`
    )
    .all(userId, userId) as GearUsageRow[];

  const items: GearStatsItem[] = rows.map((row) => {
    const price = row.price;
    const total_km = Math.round(row.total_km * 100) / 100;
    const trip_count = row.trip_count;

    let cost_per_km: number | null = null;
    if (price != null && price > 0 && total_km > 0) {
      cost_per_km = roundMoney(price / total_km);
    }

    let cost_per_trip: number | null = null;
    if (price != null && price > 0 && trip_count > 0) {
      cost_per_trip = roundMoney(price / trip_count);
    }

    return {
      gear_id: row.id,
      name: row.name,
      price,
      total_km,
      trip_count,
      cost_per_km,
      cost_per_trip,
    };
  });

  return {
    totals: {
      all_time: roundMoney(allTime),
      current_year: roundMoney(currentYear),
      current_month: roundMoney(currentMonth),
    },
    items,
  };
}
