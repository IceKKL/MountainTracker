import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { db } from '../db/index.js';
import { parseGpxFile, type GpxProfileCache } from '../lib/gpxParser.js';
import { parseFitFile } from '../lib/fitParser.js';
import { parsePeakNames, syncTripKgpPeaks } from '../lib/kgpMatch.js';
import { fetchArchive, fetchForecast, geocodePeak } from '../lib/openMeteo.js';
import { computeTripLogistics } from '../lib/tripLogistics.js';
import {
  addGearToTrip,
  excludeDefaultGear,
  getPackingRow,
  getPackingStatus,
  getPersonalPackingRows,
  getSharedPackingRows,
  removeManualGear,
  toPackingItem,
  upsertPackingStatus,
} from '../lib/tripPacking.js';
import {
  assertTripOwner,
  getAccessibleTrip,
  getTripOrThrow,
  getTripGroupIds,
  getTripParticipantsData,
  isGroupTrip,
  listAccessibleTrips,
  assertAssignedUserInTripGroups,
  isGroupMember,
} from '../lib/tripAccess.js';
import { computeAverage, resolveGpxDurationForTrip } from '@mountain-tracker/shared';
import {
  createFitUpload,
  createGpxUpload,
  createPhotoUpload,
  deleteTripFiles,
  getTripFilePath,
} from '../lib/upload.js';
import {
  resolveStatusForCreate,
  resolveStatusForUpdate,
} from '../lib/tripStatus.js';
import { resolveDurationsForStatus } from '../lib/tripDuration.js';
import { isUnknownTripDate, isValidIsoDate, isValidTripDate } from '@mountain-tracker/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  TRIP_STATUSES,
  type GpxData,
  type Trip,
  type TripDetail,
  type TripInput,
  type TripLogisticsResponse,
  type TripPhoto,
  type TripRatingItem,
  type TripRatingsResponse,
  type TripStatus,
  type TripParticipant,
  type TripParticipantStatus,
} from '../types/trip.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

router.use(authMiddleware);

function requireUser(req: Request): { id: number } {
  if (!req.user) throw new AppError(401, 'Brak autoryzacji');
  return req.user;
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

function isValidDate(value: string): boolean {
  return isValidIsoDate(value);
}

function parseOptionalInt(
  value: unknown,
  field: string
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(400, `${field} musi być dodatnią liczbą całkowitą`);
  }
  return n;
}

function parseOptionalCoord(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) throw new AppError(400, 'Nieprawidłowe współrzędne');
  return n;
}

function parseNonNegativeInt(
  value: unknown,
  field: string
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new AppError(400, `${field} musi być nieujemną liczbą całkowitą`);
  }
  return n;
}

function validateTripInput(body: unknown): TripInput {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'Nieprawidłowe dane');
  }

  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) throw new AppError(400, 'Nazwa jest wymagana');

  const peak_name = typeof data.peak_name === 'string' ? data.peak_name.trim() : '';
  if (!peak_name) throw new AppError(400, 'Nazwa szczytu jest wymagana');

  const date_start = typeof data.date_start === 'string' ? data.date_start : '';
  if (!isValidTripDate(date_start)) {
    throw new AppError(400, 'Data rozpoczęcia jest wymagana (YYYY-MM-DD lub nieznana)');
  }

  let date_end: string | null = null;
  if (!isUnknownTripDate(date_start) && data.date_end !== undefined && data.date_end !== null && data.date_end !== '') {
    if (typeof data.date_end !== 'string' || !isValidDate(data.date_end)) {
      throw new AppError(400, 'Nieprawidłowa data zakończenia');
    }
    date_end = data.date_end;
    if (date_end < date_start) {
      throw new AppError(400, 'Data zakończenia nie może być wcześniejsza niż rozpoczęcia');
    }
  }

  let kgp_peak_id: number | null = null;

  let status: TripStatus | undefined;
  if (data.status !== undefined && data.status !== null && data.status !== '') {
    if (!TRIP_STATUSES.includes(data.status as TripStatus)) {
      throw new AppError(400, 'Nieprawidłowy status');
    }
    status = data.status as TripStatus;
  }

  const lat = parseOptionalCoord(data.lat);
  const lon = parseOptionalCoord(data.lon);
  const estimated_duration_min = parseOptionalInt(
    data.estimated_duration_min,
    'Szacowany czas'
  );
  const actual_duration_min = parseOptionalInt(data.actual_duration_min, 'Rzeczywisty czas');
  const water_start_ml = parseNonNegativeInt(data.water_start_ml, 'Woda startowa');
  const food_weight_g = parseNonNegativeInt(data.food_weight_g, 'Waga jedzenia');

  let group_id: number | null | undefined;
  if (data.group_id !== undefined && data.group_id !== null && data.group_id !== '') {
    const gid = Number(data.group_id);
    if (!Number.isInteger(gid) || gid <= 0) {
      throw new AppError(400, 'Nieprawidłowy identyfikator grupy');
    }
    group_id = gid;
  }

  const notes =
    typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : null;

  return {
    name,
    kgp_peak_id,
    peak_name,
    lat,
    lon,
    date_start,
    date_end,
    status,
    notes,
    estimated_duration_min,
    actual_duration_min,
    water_start_ml,
    food_weight_g,
    group_id,
  };
}

function resolvePeakName(input: TripInput): string {
  return input.peak_name;
}

async function resolveCoordinates(
  input: TripInput,
  existing?: Trip
): Promise<{ lat: number | null; lon: number | null }> {
  const hasManualLat = input.lat !== undefined && input.lat !== null;
  const hasManualLon = input.lon !== undefined && input.lon !== null;
  if (hasManualLat && hasManualLon) {
    return { lat: input.lat!, lon: input.lon! };
  }

  const peakChanged = existing ? input.peak_name !== existing.peak_name : true;
  if (!peakChanged && existing) {
    return { lat: existing.lat, lon: existing.lon };
  }

  if (input.peak_name.trim()) {
    const geocodeName = parsePeakNames(input.peak_name)[0] ?? input.peak_name.trim();
    const coords = await geocodePeak(geocodeName);
    if (coords) return coords;
  }

  if (existing) return { lat: existing.lat, lon: existing.lon };
  return { lat: null, lon: null };
}

async function maybeCaptureOfficialWeather(trip: Trip): Promise<Trip> {
  if (trip.status !== 'zrealizowana') return trip;
  if (trip.official_weather_json) return trip;
  if (trip.lat == null || trip.lon == null || isUnknownTripDate(trip.date_start)) return trip;

  try {
    const weather = await fetchArchive(trip.lat, trip.lon, trip.date_start);
    db.prepare('UPDATE trip SET official_weather_json = ? WHERE id = ?').run(
      JSON.stringify(weather),
      trip.id
    );
    return db.prepare('SELECT * FROM trip WHERE id = ?').get(trip.id) as Trip;
  } catch (err) {
    console.error('Błąd pobierania archiwalnej pogody:', err);
    return trip;
  }
}

function getTripPhotos(tripId: number): TripPhoto[] {
  return db
    .prepare('SELECT * FROM trip_photo WHERE trip_id = ? ORDER BY uploaded_at')
    .all(tripId) as TripPhoto[];
}

function multerPhotos(req: Request, res: Response, next: NextFunction) {
  const userId = requireUser(req).id;
  const trip = getAccessibleTrip(req.params.idSlug, userId);
  assertTripOwner(trip, userId);
  createPhotoUpload(trip.id, trip.name).array('photos', 20)(req, res, (err) => {
    if (err) return next(new AppError(400, err.message));
    next();
  });
}

function multerFit(req: Request, res: Response, next: NextFunction) {
  const userId = requireUser(req).id;
  const trip = getAccessibleTrip(req.params.idSlug, userId);
  assertTripOwner(trip, userId);
  if (trip.fit_filename && trip.fit_filename !== 'activity.fit') {
    const oldPath = getTripFilePath(trip.id, trip.name, trip.fit_filename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  createFitUpload(trip.id, trip.name).single('fit')(req, res, (err) => {
    if (err) return next(new AppError(400, err.message));
    next();
  });
}

function multerGpx(req: Request, res: Response, next: NextFunction) {
  const userId = requireUser(req).id;
  const trip = getAccessibleTrip(req.params.idSlug, userId);
  assertTripOwner(trip, userId);
  if (trip.gpx_filename && trip.gpx_filename !== 'route.gpx') {
    const oldPath = getTripFilePath(trip.id, trip.name, trip.gpx_filename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  createGpxUpload(trip.id, trip.name).single('gpx')(req, res, (err) => {
    if (err) return next(new AppError(400, err.message));
    next();
  });
}

function buildGpxData(trip: Trip): GpxData | null {
  if (!trip.gpx_filename) return null;

  if (trip.gpx_profile_json) {
    try {
      const cache = JSON.parse(trip.gpx_profile_json) as GpxProfileCache;
      return {
        distance_km: trip.route_distance_km ?? 0,
        elevation_gain_m: trip.route_elevation_gain_m ?? 0,
        profile: cache.profile,
        track: cache.track,
      };
    } catch {
      /* re-parse below */
    }
  }

  const filePath = getTripFilePath(trip.id, trip.name, trip.gpx_filename);
  if (!fs.existsSync(filePath)) return null;

  const parsed = parseGpxFile(filePath);
  const cache: GpxProfileCache = { profile: parsed.profile, track: parsed.track };
  db.prepare(
    `UPDATE trip SET route_distance_km = ?, route_elevation_gain_m = ?, gpx_profile_json = ? WHERE id = ?`
  ).run(parsed.distance_km, parsed.elevation_gain_m, JSON.stringify(cache), trip.id);

  return {
    distance_km: parsed.distance_km,
    elevation_gain_m: parsed.elevation_gain_m,
    profile: parsed.profile,
    track: parsed.track,
  };
}

function assertTripCompleted(trip: Trip): void {
  if (trip.status !== 'zrealizowana') {
    throw new AppError(400, 'Oceny dostępne tylko dla zrealizowanych wycieczek');
  }
}

function getTripRatings(tripId: number): TripRatingItem[] {
  return db
    .prepare('SELECT category, score FROM trip_rating WHERE trip_id = ? ORDER BY category')
    .all(tripId) as TripRatingItem[];
}

function buildRatingsResponse(tripId: number): TripRatingsResponse {
  const ratings = getTripRatings(tripId);
  return { ratings, average: computeAverage(ratings.map((r) => r.score)) };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const { status } = req.query;

    if (status && typeof status === 'string') {
      if (!TRIP_STATUSES.includes(status as TripStatus)) {
        throw new AppError(400, 'Nieprawidłowy status');
      }
    }

    const items = listAccessibleTrips(
      userId,
      status && typeof status === 'string' ? status : undefined
    );
    res.json(items);
  })
);

router.get(
  '/:idSlug/photos',
  asyncHandler(async (req, res) => {
    const trip = getAccessibleTrip(req.params.idSlug, requireUser(req).id);
    res.json(getTripPhotos(trip.id));
  })
);

router.post(
  '/:idSlug/photos',
  multerPhotos,
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    assertTripOwner(trip, userId);
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) throw new AppError(400, 'Brak plików do uploadu');

    const insert = db.prepare(
      'INSERT INTO trip_photo (trip_id, filename) VALUES (?, ?)'
    );
    const photos: TripPhoto[] = [];
    for (const file of files) {
      const result = insert.run(trip.id, file.filename);
      photos.push(
        db.prepare('SELECT * FROM trip_photo WHERE id = ?').get(result.lastInsertRowid) as TripPhoto
      );
    }
    res.status(201).json(photos);
  })
);

router.delete(
  '/:idSlug/photos/:photoId',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    assertTripOwner(trip, userId);
    const photoId = Number(req.params.photoId);

    const photo = db
      .prepare('SELECT * FROM trip_photo WHERE id = ? AND trip_id = ?')
      .get(photoId, trip.id) as TripPhoto | undefined;
    if (!photo) throw new AppError(404, 'Zdjęcie nie znalezione');

    const filePath = getTripFilePath(trip.id, trip.name, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.prepare('DELETE FROM trip_photo WHERE id = ?').run(photoId);
    res.status(204).send();
  })
);

router.get(
  '/:idSlug/packing',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    const sharedOnly = req.query.shared === '1' || req.query.shared === 'true';
    const items = sharedOnly
      ? getSharedPackingRows(db, trip.id)
      : getPersonalPackingRows(db, trip.id, userId);

    res.json(items.map(toPackingItem));
  })
);

router.post(
  '/:idSlug/gear/:gearId',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    const gearId = Number(req.params.gearId);
    const groupTrip = isGroupTrip(trip.id);

    const gear = db
      .prepare('SELECT id, user_id FROM gear WHERE id = ?')
      .get(gearId) as { id: number; user_id: number | null } | undefined;
    if (!gear || gear.user_id !== userId) {
      throw new AppError(404, 'Sprzęt nie znaleziony');
    }

    const body = req.body as { assigned_user_id?: unknown; is_shared?: unknown };
    const isShared =
      body.is_shared === true || body.is_shared === 1 || body.is_shared === '1';
    let assignedUserId: number | null = null;

    if (isShared) {
      if (!groupTrip) {
        throw new AppError(400, 'Sprzęt wspólny wymaga wycieczki w grupie');
      }
      if (body.assigned_user_id != null) {
        assignedUserId = Number(body.assigned_user_id);
        if (!Number.isInteger(assignedUserId) || assignedUserId <= 0) {
          throw new AppError(400, 'Nieprawidłowy identyfikator użytkownika');
        }
        assertAssignedUserInTripGroups(trip.id, assignedUserId);
      }
    }

    addGearToTrip(db, trip.id, gearId, assignedUserId, isShared);

    const row = getPackingRow(db, trip.id, gearId, userId, isShared);
    if (!row) throw new AppError(500, 'Nie udało się dodać sprzętu');

    res.status(201).json(toPackingItem(row));
  })
);

router.delete(
  '/:idSlug/gear/:gearId',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    const gearId = Number(req.params.gearId);

    const gear = db
      .prepare('SELECT user_id, is_default FROM gear WHERE id = ?')
      .get(gearId) as { user_id: number | null; is_default: number } | undefined;

    const isOwner = trip.user_id === userId;
    const isGearOwner = gear?.user_id === userId;
    if (!isOwner && !isGearOwner) {
      throw new AppError(403, 'Brak uprawnień do usunięcia tego sprzętu');
    }

    const status = getPackingStatus(db, trip.id, gearId);
    if (status?.is_shared === 1) {
      if (removeManualGear(db, trip.id, gearId) === 0) {
        throw new AppError(404, 'Sprzęt nie jest przypisany do tej wycieczki');
      }
      res.status(204).send();
      return;
    }

    const onList = getPackingRow(db, trip.id, gearId, userId, false);
    if (!onList) {
      throw new AppError(404, 'Sprzęt nie jest przypisany do tej wycieczki');
    }

    if (gear?.is_default === 1) {
      excludeDefaultGear(db, trip.id, gearId);
    } else if (removeManualGear(db, trip.id, gearId) === 0) {
      throw new AppError(404, 'Sprzęt nie jest przypisany do tej wycieczki');
    }

    res.status(204).send();
  })
);

router.patch(
  '/:idSlug/packing/:gearId',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    const gearId = Number(req.params.gearId);
    const groupTrip = isGroupTrip(trip.id);

    const existing = getPackingStatus(db, trip.id, gearId);

    const body = req.body as {
      packed?: unknown;
      is_packed?: unknown;
      is_worn?: unknown;
      assigned_user_id?: unknown;
    };

    const hasPacked = typeof body.packed === 'boolean' || typeof body.is_packed === 'boolean';
    const hasWorn = typeof body.is_worn === 'boolean';
    const hasAssignee = body.assigned_user_id !== undefined;

    if (!hasPacked && !hasWorn && !hasAssignee) {
      throw new AppError(400, 'Wymagane pole is_packed, is_worn lub assigned_user_id');
    }

    const isShared = existing?.is_shared === 1;

    if (isShared) {
      if (!existing) throw new AppError(404, 'Sprzęt nie jest przypisany do tej wycieczki');
    } else if (!groupTrip) {
      const gear = db.prepare('SELECT id FROM gear WHERE id = ? AND user_id = ?').get(gearId, userId);
      if (!gear) throw new AppError(404, 'Sprzęt nie znaleziony');
      const onList = getPackingRow(db, trip.id, gearId, userId, false);
      if (!onList) throw new AppError(404, 'Sprzęt nie jest przypisany do tej wycieczki');
    } else if (!existing) {
      const onList = getPackingRow(db, trip.id, gearId, userId, false);
      if (!onList) throw new AppError(404, 'Sprzęt nie jest przypisany do tej wycieczki');
    }

    let packed = existing?.packed ?? 0;
    if (typeof body.is_packed === 'boolean') packed = body.is_packed ? 1 : 0;
    else if (typeof body.packed === 'boolean') packed = body.packed ? 1 : 0;

    let is_worn = existing?.is_worn ?? 0;
    if (typeof body.is_worn === 'boolean') is_worn = body.is_worn ? 1 : 0;

    let assigned_user_id = existing?.assigned_user_id ?? null;

    if (isShared && hasPacked) {
      if (
        existing!.assigned_user_id != null &&
        existing!.assigned_user_id !== userId
      ) {
        throw new AppError(403, 'Ten sprzęt jest przypisany do innej osoby');
      }
      if (packed === 1) {
        assigned_user_id = userId;
      } else {
        assigned_user_id = null;
      }
    } else if (isShared && hasWorn) {
      if (
        existing!.assigned_user_id != null &&
        existing!.assigned_user_id !== userId
      ) {
        throw new AppError(403, 'Ten sprzęt jest przypisany do innej osoby');
      }
    }

    if (hasAssignee && !(isShared && hasPacked)) {
      if (body.assigned_user_id === null) {
        assigned_user_id = null;
      } else {
        assigned_user_id = Number(body.assigned_user_id);
        if (!Number.isInteger(assigned_user_id) || assigned_user_id <= 0) {
          throw new AppError(400, 'Nieprawidłowy identyfikator użytkownika');
        }
        assertAssignedUserInTripGroups(trip.id, assigned_user_id);
      }
    }

    upsertPackingStatus(db, trip.id, gearId, packed, is_worn, assigned_user_id, isShared ? 1 : 0);

    const row = getPackingRow(db, trip.id, gearId, userId, isShared);
    if (!row) throw new AppError(500, 'Nie udało się zaktualizować listy pakowania');

    res.json(toPackingItem(row));
  })
);

router.get(
  '/:idSlug/ratings',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    assertTripOwner(trip, userId);
    assertTripCompleted(trip);
    res.json(buildRatingsResponse(trip.id));
  })
);

router.put(
  '/:idSlug/ratings',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    assertTripOwner(trip, userId);
    assertTripCompleted(trip);

    const body = req.body as { category?: unknown; score?: unknown };
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!category) throw new AppError(400, 'Kategoria jest wymagana');

    const score = Number(body.score);
    if (Number.isNaN(score) || score < 0 || score > 10) {
      throw new AppError(400, 'Ocena musi być w zakresie 0–10');
    }

    db.prepare(
      `INSERT INTO trip_rating (trip_id, category, score) VALUES (?, ?, ?)
       ON CONFLICT(trip_id, category) DO UPDATE SET score = excluded.score`
    ).run(trip.id, category, score);

    res.json(buildRatingsResponse(trip.id));
  })
);

router.delete(
  '/:idSlug/ratings/:category',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    assertTripOwner(trip, userId);
    assertTripCompleted(trip);

    const category = decodeURIComponent(String(req.params.category));
    const result = db
      .prepare('DELETE FROM trip_rating WHERE trip_id = ? AND category = ?')
      .run(trip.id, category);
    if (result.changes === 0) throw new AppError(404, 'Ocena nie znaleziona');

    res.json(buildRatingsResponse(trip.id));
  })
);

router.post(
  '/:idSlug/gpx',
  multerGpx,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'Brak pliku GPX');

    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    assertTripOwner(trip, userId);
    const parsed = parseGpxFile(req.file.path);
    const cache: GpxProfileCache = { profile: parsed.profile, track: parsed.track };
    const duration = resolveGpxDurationForTrip(trip.status, parsed);

    const sets = [
      'gpx_filename = ?',
      'route_distance_km = ?',
      'route_elevation_gain_m = ?',
      'gpx_profile_json = ?',
    ];
    const values: (string | number | null)[] = [
      req.file.filename,
      parsed.distance_km,
      parsed.elevation_gain_m,
      JSON.stringify(cache),
    ];

    if (duration.duration_field === 'actual_duration_min') {
      sets.push('actual_duration_min = ?');
      values.push(duration.duration_min);
    } else if (duration.duration_field === 'estimated_duration_min') {
      sets.push('estimated_duration_min = ?');
      values.push(duration.duration_min);
    }

    values.push(trip.id);
    db.prepare(`UPDATE trip SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    res.json({
      distance_km: parsed.distance_km,
      elevation_gain_m: parsed.elevation_gain_m,
      profile: parsed.profile,
      track: parsed.track,
      duration_min: duration.duration_min,
      duration_field: duration.duration_field,
      duration_estimated: duration.duration_estimated,
    } satisfies GpxData);
  })
);

router.post(
  '/:idSlug/fit',
  multerFit,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'Brak pliku FIT');

    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    assertTripOwner(trip, userId);
    const parsed = parseFitFile(req.file.path);

    const sets = ['fit_filename = ?', 'fit_total_calories = ?', 'fit_water_ml = ?'];
    const values: (string | number | null)[] = [
      req.file.filename,
      parsed.total_calories,
      parsed.total_water_ml,
    ];

    if (parsed.actual_duration_min != null) {
      sets.push('actual_duration_min = ?');
      values.push(parsed.actual_duration_min);
    }

    values.push(trip.id);
    db.prepare(`UPDATE trip SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM trip WHERE id = ?').get(trip.id) as Trip;

    res.json({
      fit_filename: updated.fit_filename,
      actual_duration_min: updated.actual_duration_min,
      total_calories: updated.fit_total_calories,
      total_water_ml: updated.fit_water_ml,
    });
  })
);

router.get(
  '/:idSlug/gpx-data',
  asyncHandler(async (req, res) => {
    const trip = getAccessibleTrip(req.params.idSlug, requireUser(req).id);
    const data = buildGpxData(trip);
    if (!data) throw new AppError(404, 'Brak pliku GPX dla tej wycieczki');
    res.json(data);
  })
);

router.get(
  '/:idSlug/forecast',
  asyncHandler(async (req, res) => {
    const trip = getAccessibleTrip(req.params.idSlug, requireUser(req).id);
    if (trip.status !== 'planowana') {
      throw new AppError(400, 'Prognoza dostępna tylko dla wycieczek planowanych');
    }
    if (trip.lat == null || trip.lon == null) {
      throw new AppError(400, 'Brak współrzędnych — nie można pobrać prognozy');
    }

    const weather = await fetchForecast(trip.lat, trip.lon);
    db.prepare('UPDATE trip SET forecast_weather_json = ? WHERE id = ?').run(
      JSON.stringify(weather),
      trip.id
    );
    res.json(weather);
  })
);

router.get(
  '/:idSlug/logistics',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);
    const logistics: TripLogisticsResponse = await computeTripLogistics(db, trip, userId);
    res.json(logistics);
  })
);

router.get(
  '/:idSlug/participants',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);

    if (!isGroupTrip(trip.id)) {
      throw new AppError(400, 'Lista uczestników dostępna tylko dla wycieczek grupowych');
    }

    const groupIds = getTripGroupIds(trip.id);
    const isMember = groupIds.some((gid) => isGroupMember(gid, userId));
    if (!isMember) {
      throw new AppError(403, 'Nie jesteś członkiem grupy tej wycieczki');
    }

    res.json(getTripParticipantsData(trip.id));
  })
);

router.get(
  '/:idSlug',
  asyncHandler(async (req, res) => {
    const trip = getAccessibleTrip(req.params.idSlug, requireUser(req).id);
    const detail: TripDetail = { ...trip, photos: getTripPhotos(trip.id) };
    res.json(detail);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const input = validateTripInput(req.body);
    const peak_name = resolvePeakName(input);
    const status = resolveStatusForCreate(input.date_start, input.status);
    const coords = await resolveCoordinates({ ...input, peak_name });

    let groupId: number | null = null;
    if (input.group_id != null) {
      if (!isGroupMember(input.group_id, userId)) {
        throw new AppError(403, 'Nie jesteś członkiem tej grupy');
      }
      groupId = input.group_id;
    }

    const durations = resolveDurationsForStatus(
      { gpx_filename: null, fit_filename: null },
      status,
      input.estimated_duration_min ?? null,
      input.actual_duration_min ?? null
    );

    const result = db
      .prepare(
        `INSERT INTO trip (
          name, kgp_peak_id, peak_name, lat, lon, date_start, date_end, status, notes,
          estimated_duration_min, actual_duration_min, water_start_ml, food_weight_g, user_id, group_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        input.kgp_peak_id ?? null,
        peak_name,
        coords.lat,
        coords.lon,
        input.date_start,
        input.date_end ?? null,
        status,
        input.notes ?? null,
        durations.estimated_duration_min,
        durations.actual_duration_min,
        input.water_start_ml ?? 2000,
        input.food_weight_g ?? 0,
        userId,
        groupId
      );

    let trip = db
      .prepare('SELECT * FROM trip WHERE id = ?')
      .get(result.lastInsertRowid) as Trip;

    const tripId = trip.id;
    syncTripKgpPeaks(tripId, peak_name);
    trip = db.prepare('SELECT * FROM trip WHERE id = ?').get(tripId) as Trip;

    if (groupId != null) {
      db.prepare(
        `INSERT INTO trip_participants (trip_id, user_id, status)
         VALUES (?, ?, 'joined')
         ON CONFLICT(trip_id, user_id) DO UPDATE SET status = 'joined', responded_at = datetime('now')`
      ).run(tripId, userId);
    }

    trip = await maybeCaptureOfficialWeather(trip);
    res.status(201).json({ ...trip, is_owner: true });
  })
);

router.post(
  '/:idSlug/respond',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getAccessibleTrip(req.params.idSlug, userId);

    if (!isGroupTrip(trip.id)) {
      throw new AppError(400, 'Deklaracja obecności dostępna tylko dla wycieczek grupowych');
    }

    const groupIds = getTripGroupIds(trip.id);
    const isMember = groupIds.some((gid) => isGroupMember(gid, userId));
    if (!isMember) {
      throw new AppError(403, 'Nie jesteś członkiem grupy tej wycieczki');
    }

    const body = req.body as { status?: unknown };
    if (body.status !== 'joined' && body.status !== 'declined') {
      throw new AppError(400, 'Pole status musi mieć wartość joined lub declined');
    }
    const status = body.status as TripParticipantStatus;

    db.prepare(
      `INSERT INTO trip_participants (trip_id, user_id, status)
       VALUES (?, ?, ?)
       ON CONFLICT(trip_id, user_id) DO UPDATE SET
         status = excluded.status,
         responded_at = datetime('now')`
    ).run(trip.id, userId, status);

    const participant = db
      .prepare(
        'SELECT trip_id, user_id, status, responded_at FROM trip_participants WHERE trip_id = ? AND user_id = ?'
      )
      .get(trip.id, userId) as TripParticipant;

    res.json(participant);
  })
);

router.put(
  '/:idSlug',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const existing = getTripOrThrow(req.params.idSlug, userId);

    const input = validateTripInput(req.body);
    const peak_name = resolvePeakName(input);
    const status = resolveStatusForUpdate(existing.status, input.status);
    const coords = await resolveCoordinates({ ...input, peak_name }, existing);
    const durations = resolveDurationsForStatus(
      existing,
      status,
      input.estimated_duration_min ?? existing.estimated_duration_min ?? null,
      input.actual_duration_min ?? existing.actual_duration_min ?? null
    );

    db.prepare(
      `UPDATE trip SET
        name = ?, kgp_peak_id = ?, peak_name = ?, lat = ?, lon = ?,
        date_start = ?, date_end = ?, status = ?, notes = ?,
        estimated_duration_min = ?, actual_duration_min = ?,
        water_start_ml = ?, food_weight_g = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      input.name,
      input.kgp_peak_id ?? null,
      peak_name,
      coords.lat,
      coords.lon,
      input.date_start,
      input.date_end ?? null,
      status,
      input.notes ?? null,
      durations.estimated_duration_min,
      durations.actual_duration_min,
      input.water_start_ml ?? existing.water_start_ml ?? 2000,
      input.food_weight_g ?? existing.food_weight_g ?? 0,
      existing.id,
      userId
    );

    let trip = db.prepare('SELECT * FROM trip WHERE id = ?').get(existing.id) as Trip;
    syncTripKgpPeaks(trip.id, peak_name);
    trip = db.prepare('SELECT * FROM trip WHERE id = ?').get(existing.id) as Trip;
    trip = await maybeCaptureOfficialWeather(trip);
    res.json(trip);
  })
);

router.delete(
  '/:idSlug',
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const trip = getTripOrThrow(req.params.idSlug, userId);
    const result = db
      .prepare('DELETE FROM trip WHERE id = ? AND user_id = ?')
      .run(trip.id, userId);
    if (result.changes === 0) throw new AppError(404, 'Wycieczka nie znaleziona');

    deleteTripFiles(trip.id, trip.name);

    res.status(204).send();
  })
);

export default router;
