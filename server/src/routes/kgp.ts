import { Router, type NextFunction, type Request, type Response } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { computeKgpConquerMeta } from '../lib/kgpMatch.js';
import { getKgpConqueredCount, KGP_TOTAL } from '../lib/kgpProgress.js';
import { withKgpUrl } from '../lib/kgpUrls.js';

export interface KgpPeak {
  id: number;
  name: string;
  mountain_range: string;
  elevation_m: number;
  kgp_url?: string | null;
}

interface TripRef {
  id: number;
  name: string;
  kgp_peak_id: number;
  trip_id: number;
}

const router = Router();

router.use(authMiddleware);

function requireUser(req: Request): { id: number } {
  if (!req.user) throw new AppError(401, 'Brak autoryzacji');
  return req.user;
}

function handler(fn: (req: Request, res: Response) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req, res);
    } catch (err) {
      next(err);
    }
  };
}

router.get(
  '/tracker',
  handler((req, res) => {
    const userId = requireUser(req).id;

    const peaks = db
      .prepare('SELECT * FROM kgp_peak ORDER BY elevation_m DESC')
      .all() as KgpPeak[];

    const trips = db
      .prepare(
        `SELECT t.id, t.name, tkp.kgp_peak_id, tkp.trip_id
         FROM trip_kgp_peak tkp
         JOIN trip t ON t.id = tkp.trip_id
         WHERE t.status = 'zrealizowana' AND t.user_id = ?
         ORDER BY t.date_start DESC`
      )
      .all(userId) as TripRef[];

    const tripsByPeak = new Map<number, { id: number; name: string }[]>();
    for (const trip of trips) {
      const list = tripsByPeak.get(trip.kgp_peak_id) ?? [];
      if (!list.some((entry) => entry.id === trip.id)) {
        list.push({ id: trip.id, name: trip.name });
      }
      tripsByPeak.set(trip.kgp_peak_id, list);
    }

    const conquerMeta = computeKgpConquerMeta(userId);

    res.json({
      progress: { conquered: getKgpConqueredCount(userId), total: KGP_TOTAL },
      peaks: peaks.map((peak) => {
        const peakTrips = tripsByPeak.get(peak.id) ?? [];
        const meta = conquerMeta.get(peak.id);
        return {
          ...withKgpUrl(peak),
          conquer_count: peakTrips.length,
          conquer_order: meta?.order ?? null,
          first_conquered_at: meta?.date ?? null,
          trips: peakTrips,
        };
      }),
    });
  })
);

router.get(
  '/',
  handler((_req, res) => {
    const peaks = db
      .prepare('SELECT * FROM kgp_peak ORDER BY elevation_m DESC')
      .all() as KgpPeak[];
    res.json(peaks.map(withKgpUrl));
  })
);

export default router;
