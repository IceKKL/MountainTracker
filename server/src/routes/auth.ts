import { Router, type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { authMiddleware, signToken } from '../middleware/auth.js';

const router = Router();

function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function assertValidUsername(username: string): void {
  if (!username || username.length > 64) {
    throw new AppError(400, 'Nieprawidłowy login');
  }
}

router.post(
  '/register',
  handler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const username = normalizeUsername(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    assertValidUsername(username);
    if (password.length < 8) {
      throw new AppError(400, 'Hasło musi mieć co najmniej 8 znaków');
    }
    if (!name) {
      throw new AppError(400, 'Imię jest wymagane');
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      throw new AppError(409, 'Konto z tym loginem już istnieje');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db
      .prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)')
      .run(username, passwordHash, name);

    const user = {
      id: Number(result.lastInsertRowid),
      username,
      name,
    };

    res.status(201).json({ token: signToken(user.id, user.username), user });
  })
);

router.post(
  '/login',
  handler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const username = normalizeUsername(body.username);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      throw new AppError(400, 'Login i hasło są wymagane');
    }

    const user = db
      .prepare('SELECT id, username, name, password_hash FROM users WHERE username = ?')
      .get(username) as
      | { id: number; username: string; name: string; password_hash: string }
      | undefined;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new AppError(401, 'Nieprawidłowy login lub hasło');
    }

    res.json({
      token: signToken(user.id, user.username),
      user: { id: user.id, username: user.username, name: user.name },
    });
  })
);

router.get(
  '/me',
  authMiddleware,
  handler(async (req, res) => {
    if (!req.user) throw new AppError(401, 'Brak autoryzacji');
    res.json(req.user);
  })
);

export default router;
