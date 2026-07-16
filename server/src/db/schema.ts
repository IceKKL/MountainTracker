import type Database from 'better-sqlite3';

export function runSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS gear (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      season TEXT NOT NULL CHECK (season IN ('lato', 'zima', 'uniwersalny')),
      brand TEXT,
      weight_g INTEGER,
      notes TEXT,
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kgp_peak (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      mountain_range TEXT NOT NULL,
      elevation_m INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kgp_peak_id INTEGER REFERENCES kgp_peak(id),
      peak_name TEXT NOT NULL,
      lat REAL,
      lon REAL,
      date_start TEXT NOT NULL,
      date_end TEXT,
      status TEXT NOT NULL CHECK (status IN ('planowana', 'zrealizowana')),
      notes TEXT,
      gpx_filename TEXT,
      route_distance_km REAL,
      route_elevation_gain_m REAL,
      estimated_duration_min INTEGER,
      actual_duration_min INTEGER,
      forecast_weather_json TEXT,
      official_weather_json TEXT
    );

    CREATE TABLE IF NOT EXISTS trip_photo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trip_gear_status (
      trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
      gear_id INTEGER NOT NULL REFERENCES gear(id) ON DELETE CASCADE,
      packed INTEGER NOT NULL DEFAULT 0 CHECK (packed IN (0, 1)),
      is_worn INTEGER NOT NULL DEFAULT 0 CHECK (is_worn IN (0, 1)),
      assigned_user_id INTEGER REFERENCES users(id),
      is_shared INTEGER NOT NULL DEFAULT 0 CHECK (is_shared IN (0, 1)),
      is_excluded INTEGER NOT NULL DEFAULT 0 CHECK (is_excluded IN (0, 1)),
      PRIMARY KEY (trip_id, gear_id)
    );

    CREATE TABLE IF NOT EXISTS trip_participants (
      trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('joined', 'declined')),
      responded_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (trip_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS trip_rating (
      trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      score REAL NOT NULL CHECK (score >= 0 AND score <= 10),
      PRIMARY KEY (trip_id, category)
    );

    CREATE TABLE IF NOT EXISTS trip_kgp_peak (
      trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
      kgp_peak_id INTEGER NOT NULL REFERENCES kgp_peak(id) ON DELETE CASCADE,
      PRIMARY KEY (trip_id, kgp_peak_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS group_shared_trips (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (group_id, trip_id)
    );
  `);

  migrateUsersToUsername(db);

  db.exec(`
    INSERT OR IGNORE INTO trip_kgp_peak (trip_id, kgp_peak_id)
    SELECT id, kgp_peak_id FROM trip WHERE kgp_peak_id IS NOT NULL
  `);

  const gearCols = db.prepare('PRAGMA table_info(gear)').all() as { name: string }[];
  if (!gearCols.some((c) => c.name === 'is_default')) {
    db.exec('ALTER TABLE gear ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1))');
  }
  if (!gearCols.some((c) => c.name === 'price')) {
    db.exec('ALTER TABLE gear ADD COLUMN price REAL');
  }
  if (!gearCols.some((c) => c.name === 'purchase_date')) {
    db.exec('ALTER TABLE gear ADD COLUMN purchase_date TEXT');
  }
  if (!gearCols.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE gear ADD COLUMN user_id INTEGER REFERENCES users(id)');
  }

  const tripCols = db.prepare('PRAGMA table_info(trip)').all() as { name: string }[];
  if (!tripCols.some((c) => c.name === 'gpx_profile_json')) {
    db.exec('ALTER TABLE trip ADD COLUMN gpx_profile_json TEXT');
  }
  if (!tripCols.some((c) => c.name === 'water_start_ml')) {
    db.exec('ALTER TABLE trip ADD COLUMN water_start_ml INTEGER NOT NULL DEFAULT 2000');
  }
  if (!tripCols.some((c) => c.name === 'food_weight_g')) {
    db.exec('ALTER TABLE trip ADD COLUMN food_weight_g INTEGER NOT NULL DEFAULT 0');
  }
  if (!tripCols.some((c) => c.name === 'fit_filename')) {
    db.exec('ALTER TABLE trip ADD COLUMN fit_filename TEXT');
  }
  if (!tripCols.some((c) => c.name === 'fit_total_calories')) {
    db.exec('ALTER TABLE trip ADD COLUMN fit_total_calories INTEGER');
  }
  if (!tripCols.some((c) => c.name === 'fit_water_ml')) {
    db.exec('ALTER TABLE trip ADD COLUMN fit_water_ml INTEGER');
  }
  if (!tripCols.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE trip ADD COLUMN user_id INTEGER REFERENCES users(id)');
  }
  if (!tripCols.some((c) => c.name === 'group_id')) {
    db.exec('ALTER TABLE trip ADD COLUMN group_id INTEGER REFERENCES groups(id)');
  }

  migrateTripGearToStatus(db);
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return !!row;
}

function migrateTripGearToStatus(db: Database.Database): void {
  if (!tableExists(db, 'trip_gear')) return;

  const tripGearCols = db.prepare('PRAGMA table_info(trip_gear)').all() as { name: string }[];
  if (!tripGearCols.some((c) => c.name === 'is_worn')) {
    db.exec('ALTER TABLE trip_gear ADD COLUMN is_worn INTEGER NOT NULL DEFAULT 0 CHECK (is_worn IN (0, 1))');
  }
  if (!tripGearCols.some((c) => c.name === 'assigned_user_id')) {
    db.exec('ALTER TABLE trip_gear ADD COLUMN assigned_user_id INTEGER REFERENCES users(id)');
  }
  if (!tripGearCols.some((c) => c.name === 'is_shared')) {
    db.exec('ALTER TABLE trip_gear ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0 CHECK (is_shared IN (0, 1))');
  }

  db.exec(`
    INSERT OR IGNORE INTO trip_gear_status (trip_id, gear_id, packed, is_worn, assigned_user_id, is_shared, is_excluded)
    SELECT trip_id, gear_id, packed, is_worn, assigned_user_id, is_shared, 0 FROM trip_gear
  `);

  db.exec(`
    DELETE FROM trip_gear_status
    WHERE is_shared = 0 AND packed = 0 AND is_worn = 0
      AND assigned_user_id IS NULL
      AND gear_id IN (SELECT id FROM gear WHERE is_default = 1)
  `);

  db.exec('DROP TABLE trip_gear');
}

function migrateUsersToUsername(db: Database.Database): void {
  const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const hasEmail = userCols.some((c) => c.name === 'email');
  const hasUsername = userCols.some((c) => c.name === 'username');
  if (!hasEmail || hasUsername) return;

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO users_new (id, username, password_hash, name, created_at)
      SELECT
        id,
        lower(replace(substr(email, 1, instr(email, '@') - 1), ' ', '.')),
        password_hash,
        name,
        created_at
      FROM users;

      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
