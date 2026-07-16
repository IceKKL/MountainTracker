import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSchema } from './schema.js';
import { seedKgpPeaks } from './seedKgp.js';
import { resyncAllTripKgpPeaks } from '../lib/kgpMatch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
const dbPath = path.join(dataDir, 'db.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);

export function initDatabase(): void {
  runSchema(db);
  seedKgpPeaks(db);
  resyncAllTripKgpPeaks();
}
