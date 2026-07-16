import type { Request } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { AppError } from '../middleware/errorHandler.js';
import { tripSlug } from '@mountain-tracker/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsRoot = path.join(__dirname, '../../uploads/trips');

const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;
const GPX_EXT = /\.gpx$/i;

export function tripDirName(tripId: number, tripName: string): string {
  return tripSlug(tripId, tripName);
}

function tripDir(tripId: number, tripName: string): string {
  return path.join(uploadsRoot, tripDirName(tripId, tripName));
}

function ensureTripDir(tripId: number, tripName: string): string {
  const dir = tripDir(tripId, tripName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function photoFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (PHOTO_EXT.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new AppError(400, 'Dozwolone formaty zdjęć: jpg, png, webp'));
  }
}

function gpxFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (GPX_EXT.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new AppError(400, 'Dozwolony format trasy: .gpx'));
  }
}

function fitFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (path.extname(file.originalname).toLowerCase() === '.fit') {
    cb(null, true);
  } else {
    cb(new AppError(400, 'Dozwolony format telemetryczny: .fit'));
  }
}

export function createPhotoUpload(tripId: number, tripName: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureTripDir(tripId, tripName)),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `photo-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: photoFilter,
  });
}

export function createGpxUpload(tripId: number, tripName: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureTripDir(tripId, tripName)),
      filename: (_req, _file, cb) => cb(null, 'route.gpx'),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: gpxFilter,
  });
}

export function createFitUpload(tripId: number, tripName: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureTripDir(tripId, tripName)),
      filename: (_req, _file, cb) => cb(null, 'activity.fit'),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: fitFilter,
  });
}

export function getTripFilePath(tripId: number, tripName: string, filename: string): string {
  return path.join(tripDir(tripId, tripName), filename);
}

export function deleteTripFiles(tripId: number, tripName: string): void {
  const dir = tripDir(tripId, tripName);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
