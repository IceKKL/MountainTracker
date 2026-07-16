import jwt, { type SignOptions } from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/index.js';
import { AppError } from './errorHandler.js';

let jwtSecretWarned = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (!jwtSecretWarned) {
    console.warn('[auth] JWT_SECRET nie ustawiony — używany jest domyślny klucz deweloperski.');
    jwtSecretWarned = true;
  }
  return 'mountain-tracker-dev-secret';
}

export function signToken(id: number, username: string): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];
  return jwt.sign({ id, username }, getJwtSecret(), { expiresIn });
}

type JwtPayload = { id?: number; username?: string; userId?: number };

type AuthUser = { id: number; username: string; name: string };

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, 'Brak autoryzacji');
    }

    const payload = jwt.verify(header.slice(7), getJwtSecret()) as JwtPayload;
    const userId = payload.id ?? payload.userId;
    if (userId == null) {
      throw new AppError(401, 'Nieprawidłowy token');
    }

    const user = db
      .prepare('SELECT id, username, name FROM users WHERE id = ?')
      .get(userId) as AuthUser | undefined;

    if (!user) {
      throw new AppError(401, 'Nieprawidłowy token');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError(401, 'Nieprawidłowy token'));
  }
}
