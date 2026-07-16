import type Database from 'better-sqlite3';
import type { TripPackingItem } from '../types/trip.js';

export type TripGearRow = {
  gear_id: number;
  name: string;
  category: string;
  season: string;
  weight_g: number | null;
  packed: number;
  is_worn: number;
  assigned_user_id: number | null;
  assigned_username: string | null;
  assigned_name: string | null;
  is_shared: number;
};

const PACKING_SELECT = `SELECT g.id AS gear_id, g.name, g.category, g.season, g.weight_g,
       COALESCE(tgs.packed, 0) AS packed,
       COALESCE(tgs.is_worn, 0) AS is_worn,
       tgs.assigned_user_id,
       COALESCE(tgs.is_shared, 0) AS is_shared,
       u.username AS assigned_username, u.name AS assigned_name`;

export function toPackingItem(row: TripGearRow): TripPackingItem {
  const packed = row.packed === 1;
  return {
    gear_id: row.gear_id,
    name: row.name,
    category: row.category,
    season: row.season,
    weight_g: row.weight_g,
    packed,
    is_packed: packed,
    is_worn: row.is_worn === 1,
    assigned_user_id: row.assigned_user_id,
    assigned_username: row.assigned_username,
    assigned_name: row.assigned_name,
    is_shared: row.is_shared === 1,
  };
}

export function getPersonalPackingRows(
  db: Database.Database,
  tripId: number,
  userId: number
): TripGearRow[] {
  return db
    .prepare(
      `${PACKING_SELECT}
       FROM gear g
       LEFT JOIN trip_gear_status tgs ON tgs.trip_id = ? AND tgs.gear_id = g.id
       LEFT JOIN users u ON u.id = tgs.assigned_user_id
       WHERE g.user_id = ?
         AND COALESCE(tgs.is_shared, 0) = 0
         AND COALESCE(tgs.is_excluded, 0) = 0
         AND (g.is_default = 1 OR tgs.trip_id IS NOT NULL)
       ORDER BY g.category, g.name`
    )
    .all(tripId, userId) as TripGearRow[];
}

export function getSharedPackingRows(db: Database.Database, tripId: number): TripGearRow[] {
  return db
    .prepare(
      `${PACKING_SELECT}
       FROM trip_gear_status tgs
       JOIN gear g ON g.id = tgs.gear_id
       LEFT JOIN users u ON u.id = tgs.assigned_user_id
       WHERE tgs.trip_id = ? AND tgs.is_shared = 1 AND tgs.is_excluded = 0
       ORDER BY g.category, g.name`
    )
    .all(tripId) as TripGearRow[];
}

export function getPackingRow(
  db: Database.Database,
  tripId: number,
  gearId: number,
  userId: number,
  shared: boolean
): TripGearRow | undefined {
  if (shared) {
    return db
      .prepare(
        `${PACKING_SELECT}
         FROM trip_gear_status tgs
         JOIN gear g ON g.id = tgs.gear_id
         LEFT JOIN users u ON u.id = tgs.assigned_user_id
         WHERE tgs.trip_id = ? AND tgs.gear_id = ? AND tgs.is_shared = 1 AND tgs.is_excluded = 0`
      )
      .get(tripId, gearId) as TripGearRow | undefined;
  }

  return db
    .prepare(
      `${PACKING_SELECT}
       FROM gear g
       LEFT JOIN trip_gear_status tgs ON tgs.trip_id = ? AND tgs.gear_id = g.id
       LEFT JOIN users u ON u.id = tgs.assigned_user_id
       WHERE g.id = ? AND g.user_id = ?
         AND COALESCE(tgs.is_shared, 0) = 0
         AND COALESCE(tgs.is_excluded, 0) = 0
         AND (g.is_default = 1 OR tgs.trip_id IS NOT NULL)`
    )
    .get(tripId, gearId, userId) as TripGearRow | undefined;
}

export type PackingStatusRow = {
  packed: number;
  is_worn: number;
  assigned_user_id: number | null;
  is_shared: number;
};

export function getPackingStatus(
  db: Database.Database,
  tripId: number,
  gearId: number
): PackingStatusRow | undefined {
  return db
    .prepare(
      'SELECT packed, is_worn, assigned_user_id, is_shared FROM trip_gear_status WHERE trip_id = ? AND gear_id = ?'
    )
    .get(tripId, gearId) as PackingStatusRow | undefined;
}

export function upsertPackingStatus(
  db: Database.Database,
  tripId: number,
  gearId: number,
  packed: number,
  isWorn: number,
  assignedUserId: number | null,
  isShared: number
): void {
  db.prepare(
    `INSERT INTO trip_gear_status (trip_id, gear_id, packed, is_worn, assigned_user_id, is_shared, is_excluded)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(trip_id, gear_id) DO UPDATE SET
       packed = excluded.packed,
       is_worn = excluded.is_worn,
       assigned_user_id = excluded.assigned_user_id,
       is_shared = excluded.is_shared,
       is_excluded = 0`
  ).run(tripId, gearId, packed, isWorn, assignedUserId, isShared);
}

export function addGearToTrip(
  db: Database.Database,
  tripId: number,
  gearId: number,
  assignedUserId: number | null,
  isShared: boolean
): void {
  db.prepare(
    `INSERT INTO trip_gear_status (trip_id, gear_id, packed, is_worn, assigned_user_id, is_shared, is_excluded)
     VALUES (?, ?, 0, 0, ?, ?, 0)
     ON CONFLICT(trip_id, gear_id) DO UPDATE SET
       is_excluded = 0,
       is_shared = excluded.is_shared,
       assigned_user_id = excluded.assigned_user_id`
  ).run(tripId, gearId, assignedUserId, isShared ? 1 : 0);
}

export function excludeDefaultGear(
  db: Database.Database,
  tripId: number,
  gearId: number
): void {
  db.prepare(
    `INSERT INTO trip_gear_status (trip_id, gear_id, packed, is_worn, assigned_user_id, is_shared, is_excluded)
     VALUES (?, ?, 0, 0, NULL, 0, 1)
     ON CONFLICT(trip_id, gear_id) DO UPDATE SET is_excluded = 1`
  ).run(tripId, gearId);
}

export function removeManualGear(
  db: Database.Database,
  tripId: number,
  gearId: number
): number {
  return db
    .prepare('DELETE FROM trip_gear_status WHERE trip_id = ? AND gear_id = ?')
    .run(tripId, gearId).changes;
}

export function countPersonalPacking(
  db: Database.Database,
  tripId: number,
  userId: number
): { total: number; packed: number } {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(COALESCE(tgs.packed, 0)), 0) AS packed
       FROM gear g
       LEFT JOIN trip_gear_status tgs ON tgs.trip_id = ? AND tgs.gear_id = g.id
       WHERE g.user_id = ?
         AND COALESCE(tgs.is_shared, 0) = 0
         AND COALESCE(tgs.is_excluded, 0) = 0
         AND (g.is_default = 1 OR tgs.trip_id IS NOT NULL)`
    )
    .get(tripId, userId) as { total: number; packed: number };
  return { total: row.total ?? 0, packed: row.packed ?? 0 };
}
