import { Router, type NextFunction, type Request, type Response } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getUserActivityStats } from '../lib/activityStats.js';
import { getKgpConqueredCount, KGP_TOTAL } from '../lib/kgpProgress.js';
import { fetchForecast } from '../lib/openMeteo.js';
import { countPersonalPacking } from '../lib/tripPacking.js';
import {
  getEffectiveGroupId,
  getNextAccessiblePlannedTrip,
  getTripJoinedCompanions,
} from '../lib/tripAccess.js';
import type { Trip } from '../types/trip.js';

const router = Router();

router.use(authMiddleware);

function requireUser(req: Request): { id: number } {
  if (!req.user) throw new AppError(401, 'Brak autoryzacji');
  return req.user;
}

function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

router.get(
  '/',
  handler(async (req, res) => {
    const userId = requireUser(req).id;

    const nextTrip = getNextAccessiblePlannedTrip(userId);

    const lastCompletedTrip = db
      .prepare(
        `SELECT * FROM trip
         WHERE user_id = ? AND status = 'zrealizowana'
         ORDER BY date_start DESC
         LIMIT 1`
      )
      .get(userId) as Trip | undefined;

    const plannedUnknownDateRow = db
      .prepare(
        `SELECT COUNT(*) AS count FROM trip
         WHERE user_id = ? AND status = 'planowana' AND date_start = 'nieznana'`
      )
      .get(userId) as { count: number };

    let next_trip_group: { id: number; name: string; member_count: number } | null = null;
    if (nextTrip) {
      const effectiveGroupId = getEffectiveGroupId(nextTrip.id);
      if (effectiveGroupId != null) {
        const group = db
          .prepare(
            `SELECT g.id, g.name,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
             FROM groups g WHERE g.id = ?`
          )
          .get(effectiveGroupId) as
          | { id: number; name: string; member_count: number }
          | undefined;
        if (group) next_trip_group = group;
      }
    }

    const last_trip_companions = lastCompletedTrip
      ? getTripJoinedCompanions(lastCompletedTrip.id, userId)
      : [];

    let next_trip_packing: { packed: number; total: number } | null = null;
    if (nextTrip) {
      const packing = countPersonalPacking(db, nextTrip.id, userId);
      if (packing.total > 0) {
        next_trip_packing = { packed: packing.packed, total: packing.total };
      }
    }

    let next_trip_weather: unknown = null;
    if (nextTrip?.lat != null && nextTrip.lon != null) {
      try {
        next_trip_weather = await fetchForecast(nextTrip.lat, nextTrip.lon);
        db.prepare('UPDATE trip SET forecast_weather_json = ? WHERE id = ?').run(
          JSON.stringify(next_trip_weather),
          nextTrip.id
        );
      } catch (err) {
        console.error('Błąd pobierania prognozy dla dashboardu:', err);
        if (nextTrip.forecast_weather_json) {
          try {
            next_trip_weather = JSON.parse(nextTrip.forecast_weather_json);
          } catch {
            next_trip_weather = null;
          }
        }
      }
    }

    res.json({
      kgp_progress: { conquered: getKgpConqueredCount(userId), total: KGP_TOTAL },
      activity_stats: {
        month: getUserActivityStats(userId, 'month'),
        year: getUserActivityStats(userId, 'year'),
      },
      next_trip: nextTrip ?? null,
      next_trip_group,
      next_trip_weather,
      next_trip_packing,
      planned_unknown_date_count: plannedUnknownDateRow.count,
      last_completed_trip: lastCompletedTrip ?? null,
      last_trip_companions,
    });
  })
);

export default router;
