import { db } from '../db/index.js';

export function parsePeakNames(peakName: string): string[] {
  return peakName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolveKgpPeakIds(peakName: string): number[] {
  const parts = parsePeakNames(peakName);
  if (parts.length === 0) return [];

  const peaks = db.prepare('SELECT id, name FROM kgp_peak').all() as {
    id: number;
    name: string;
  }[];
  const byName = new Map(peaks.map((p) => [p.name.toLowerCase(), p.id]));

  const ids: number[] = [];
  for (const part of parts) {
    const id = byName.get(part.toLowerCase());
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function syncTripKgpPeaks(tripId: number, peakName: string): number | null {
  const ids = resolveKgpPeakIds(peakName);

  db.prepare('DELETE FROM trip_kgp_peak WHERE trip_id = ?').run(tripId);

  const insert = db.prepare(
    'INSERT INTO trip_kgp_peak (trip_id, kgp_peak_id) VALUES (?, ?)'
  );
  for (const id of ids) {
    insert.run(tripId, id);
  }

  const primaryId = ids[0] ?? null;
  db.prepare('UPDATE trip SET kgp_peak_id = ? WHERE id = ?').run(primaryId, tripId);
  return primaryId;
}

export function resyncAllTripKgpPeaks(): void {
  const trips = db.prepare('SELECT id, peak_name FROM trip').all() as {
    id: number;
    peak_name: string;
  }[];
  const resync = db.transaction(() => {
    for (const trip of trips) {
      syncTripKgpPeaks(trip.id, trip.peak_name);
    }
  });
  resync();
}

export function computeKgpConquerMeta(userId: number): Map<number, { order: number; date: string }> {
  const trips = db
    .prepare(
      `SELECT id, peak_name, date_start FROM trip
       WHERE status = 'zrealizowana' AND user_id = ?
       ORDER BY date_start ASC, id ASC`
    )
    .all(userId) as { id: number; peak_name: string; date_start: string }[];

  const meta = new Map<number, { order: number; date: string }>();
  let nextOrder = 1;

  for (const trip of trips) {
    for (const peakId of resolveKgpPeakIds(trip.peak_name)) {
      if (!meta.has(peakId)) {
        meta.set(peakId, { order: nextOrder++, date: trip.date_start });
      }
    }
  }

  return meta;
}
