import { Router, type NextFunction, type Request, type Response } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  GEAR_CATEGORIES,
  GEAR_SEASONS,
  type Gear,
  type GearInput,
  type GearStatsResponse,
} from '../types/gear.js';
import { computeGearStats } from '../lib/gearStats.js';

const router = Router();

router.use(authMiddleware);

type GearRow = Omit<Gear, 'is_default'> & { is_default: number };

function requireUser(req: Request): { id: number } {
  if (!req.user) throw new AppError(401, 'Brak autoryzacji');
  return req.user;
}

function mapGear(row: GearRow): Gear {
  return { ...row, is_default: row.is_default === 1 };
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

function validateGearInput(body: unknown): GearInput {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'Nieprawidłowe dane');
  }

  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) throw new AppError(400, 'Nazwa jest wymagana');

  const category = data.category;
  if (!GEAR_CATEGORIES.includes(category as GearInput['category'])) {
    throw new AppError(400, 'Nieprawidłowa kategoria');
  }

  const season = data.season;
  if (!GEAR_SEASONS.includes(season as GearInput['season'])) {
    throw new AppError(400, 'Nieprawidłowy sezon');
  }

  let weight_g: number | null = null;
  if (data.weight_g !== undefined && data.weight_g !== null && data.weight_g !== '') {
    const w = Number(data.weight_g);
    if (!Number.isInteger(w) || w <= 0) {
      throw new AppError(400, 'Waga musi być dodatnią liczbą całkowitą');
    }
    weight_g = w;
  }

  const brand =
    typeof data.brand === 'string' && data.brand.trim() ? data.brand.trim() : null;
  const notes =
    typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : null;

  let is_default: boolean | undefined;
  if (data.is_default !== undefined && data.is_default !== null) {
    if (typeof data.is_default !== 'boolean') {
      throw new AppError(400, 'Pole is_default musi być boolean');
    }
    is_default = data.is_default;
  }

  let price: number | null = null;
  if (data.price !== undefined && data.price !== null && data.price !== '') {
    const p = Number(data.price);
    if (Number.isNaN(p) || p <= 0) {
      throw new AppError(400, 'Cena musi być dodatnią liczbą');
    }
    price = Math.round(p * 100) / 100;
  }

  let purchase_date: string | null = null;
  if (data.purchase_date !== undefined && data.purchase_date !== null && data.purchase_date !== '') {
    if (typeof data.purchase_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.purchase_date)) {
      throw new AppError(400, 'Nieprawidłowa data zakupu (YYYY-MM-DD)');
    }
    purchase_date = data.purchase_date;
  }

  return {
    name,
    category: category as GearInput['category'],
    season: season as GearInput['season'],
    brand,
    weight_g,
    price,
    purchase_date,
    notes,
    is_default,
  };
}

router.get('/', handler((req, res) => {
  const userId = requireUser(req).id;
  const { category, season } = req.query;
  let sql = 'SELECT * FROM gear WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (category && typeof category === 'string') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (season && typeof season === 'string') {
    sql += ' AND season = ?';
    params.push(season);
  }
  sql += ' ORDER BY created_at DESC';

  const items = (db.prepare(sql).all(...params) as GearRow[]).map(mapGear);
  res.json(items);
}));

router.get('/stats', handler((req, res) => {
  const stats: GearStatsResponse = computeGearStats(db, requireUser(req).id);
  res.json(stats);
}));

router.get('/:id', handler((req, res) => {
  const userId = requireUser(req).id;
  const item = db.prepare('SELECT * FROM gear WHERE id = ? AND user_id = ?').get(req.params.id, userId) as
    | GearRow
    | undefined;
  if (!item) throw new AppError(404, 'Sprzęt nie znaleziony');
  res.json(mapGear(item));
}));

router.post('/', handler((req, res) => {
  const userId = requireUser(req).id;
  const input = validateGearInput(req.body);
  const result = db
    .prepare(
      `INSERT INTO gear (name, category, season, brand, weight_g, price, purchase_date, notes, is_default, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.name,
      input.category,
      input.season,
      input.brand,
      input.weight_g,
      input.price,
      input.purchase_date,
      input.notes,
      (input.is_default ?? false) ? 1 : 0,
      userId
    );

  const item = db.prepare('SELECT * FROM gear WHERE id = ?').get(result.lastInsertRowid) as GearRow;
  res.status(201).json(mapGear(item));
}));

router.put('/:id', handler((req, res) => {
  const userId = requireUser(req).id;
  const existing = db.prepare('SELECT id FROM gear WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!existing) throw new AppError(404, 'Sprzęt nie znaleziony');

  const input = validateGearInput(req.body);
  const existingRow = db
    .prepare('SELECT is_default FROM gear WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId) as { is_default: number } | undefined;
  const isDefault =
    input.is_default !== undefined ? (input.is_default ? 1 : 0) : existingRow!.is_default;

  db.prepare(
    `UPDATE gear SET name = ?, category = ?, season = ?, brand = ?, weight_g = ?, price = ?, purchase_date = ?, notes = ?, is_default = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    input.name,
    input.category,
    input.season,
    input.brand,
    input.weight_g,
    input.price,
    input.purchase_date,
    input.notes,
    isDefault,
    req.params.id,
    userId
  );

  const item = db
    .prepare('SELECT * FROM gear WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId) as GearRow;
  res.json(mapGear(item));
}));

router.patch('/:id/default', handler((req, res) => {
  const userId = requireUser(req).id;
  const existing = db.prepare('SELECT id FROM gear WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!existing) throw new AppError(404, 'Sprzęt nie znaleziony');

  const body = req.body as { is_default?: unknown };
  if (typeof body.is_default !== 'boolean') {
    throw new AppError(400, 'Pole is_default (boolean) jest wymagane');
  }

  db.prepare('UPDATE gear SET is_default = ? WHERE id = ? AND user_id = ?').run(
    body.is_default ? 1 : 0,
    req.params.id,
    userId
  );

  const item = db
    .prepare('SELECT * FROM gear WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId) as GearRow;
  res.json(mapGear(item));
}));

router.delete('/:id', handler((req, res) => {
  const userId = requireUser(req).id;
  const result = db.prepare('DELETE FROM gear WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  if (result.changes === 0) throw new AppError(404, 'Sprzęt nie znaleziony');
  res.status(204).send();
}));

export default router;
