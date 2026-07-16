import { db } from '../db/index.js';

export const KGP_TOTAL = 28;

export function getKgpConqueredCount(userId: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT tkp.kgp_peak_id) as count
       FROM trip_kgp_peak tkp
       JOIN trip t ON t.id = tkp.trip_id
       WHERE t.status = 'zrealizowana' AND t.user_id = ?`
    )
    .get(userId) as { count: number };
  return row.count;
}
