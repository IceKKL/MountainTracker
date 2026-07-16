import { Router, type NextFunction, type Request, type Response } from 'express';
import { db } from '../db/index.js';
import { generateInviteCode } from '../lib/inviteCode.js';
import { getGroupActivityStats } from '../lib/activityStats.js';
import { isGroupMember } from '../lib/tripAccess.js';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Group, GroupDetail, GroupMember, GroupTripSummary } from '@mountain-tracker/shared';

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

function parseGroupId(raw: string | string[]): number {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Nieprawidłowy identyfikator grupy');
  return id;
}

function assertMember(groupId: number, userId: number): void {
  if (!isGroupMember(groupId, userId)) {
    throw new AppError(403, 'Brak dostępu do tej grupy');
  }
}

function getGroupTrips(groupId: number, userId: number): GroupTripSummary[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT t.id, t.name, t.peak_name, t.status, t.date_start, t.user_id,
              t.lat, t.lon, t.gpx_filename, t.gpx_profile_json,
              u.username as owner_username
       FROM trip t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN group_shared_trips gst ON gst.trip_id = t.id AND gst.group_id = ?
       WHERE t.group_id = ? OR gst.group_id = ?
       ORDER BY t.date_start DESC`
    )
    .all(groupId, groupId, groupId) as {
    id: number;
    name: string;
    peak_name: string;
    status: string;
    date_start: string;
    user_id: number;
    lat: number | null;
    lon: number | null;
    gpx_filename: string | null;
    gpx_profile_json: string | null;
    owner_username: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    peak_name: row.peak_name,
    status: row.status,
    date_start: row.date_start,
    owner_username: row.owner_username,
    is_owner: row.user_id === userId,
    lat: row.lat,
    lon: row.lon,
    gpx_filename: row.gpx_filename,
    gpx_profile_json: row.gpx_profile_json,
  }));
}

router.get(
  '/',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const rows = db
      .prepare(
        `SELECT g.id, g.name, g.invite_code,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = ?
         ORDER BY g.name`
      )
      .all(userId) as (Group & { member_count: number })[];

    res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        invite_code: row.invite_code,
        member_count: row.member_count,
      }))
    );
  })
);

router.post(
  '/',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const body = req.body as { name?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new AppError(400, 'Nazwa grupy jest wymagana');

    const invite_code = generateInviteCode();
    const result = db
      .prepare('INSERT INTO groups (name, invite_code, created_by) VALUES (?, ?, ?)')
      .run(name, invite_code, userId);

    const groupId = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, userId);

    res.status(201).json({ id: groupId, name, invite_code });
  })
);

router.post(
  '/join',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const body = req.body as { invite_code?: unknown };
    const invite_code = typeof body.invite_code === 'string' ? body.invite_code.trim() : '';
    if (!invite_code) throw new AppError(400, 'Kod zaproszenia jest wymagany');

    const group = db
      .prepare('SELECT id, name, invite_code FROM groups WHERE invite_code = ?')
      .get(invite_code) as Group | undefined;
    if (!group) throw new AppError(404, 'Nie znaleziono grupy o podanym kodzie');

    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(
      group.id,
      userId
    );

    res.json(group);
  })
);

router.get(
  '/:id/members',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const groupId = parseGroupId(req.params.id);
    assertMember(groupId, userId);

    const members = db
      .prepare(
        `SELECT u.id, u.username, u.name
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY u.name`
      )
      .all(groupId) as GroupMember[];

    res.json(members);
  })
);

router.post(
  '/:id/share-trip',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const groupId = parseGroupId(req.params.id);
    assertMember(groupId, userId);

    const body = req.body as { trip_id?: unknown };
    const tripId = Number(body.trip_id);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      throw new AppError(400, 'Nieprawidłowy identyfikator wycieczki');
    }

    const trip = db
      .prepare('SELECT id, user_id FROM trip WHERE id = ?')
      .get(tripId) as { id: number; user_id: number } | undefined;
    if (!trip) throw new AppError(404, 'Wycieczka nie znaleziona');
    if (trip.user_id !== userId) {
      throw new AppError(403, 'Tylko właściciel może udostępnić wycieczkę');
    }

    const existing = db
      .prepare('SELECT 1 FROM group_shared_trips WHERE group_id = ? AND trip_id = ?')
      .get(groupId, tripId);
    if (existing) throw new AppError(409, 'Wycieczka jest już udostępniona w tej grupie');

    db.prepare(
      'INSERT INTO group_shared_trips (group_id, trip_id, user_id) VALUES (?, ?, ?)'
    ).run(groupId, tripId, userId);

    res.status(201).json({ group_id: groupId, trip_id: tripId });
  })
);

router.delete(
  '/:id/share-trip',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const groupId = parseGroupId(req.params.id);
    assertMember(groupId, userId);

    const body = req.body as { trip_id?: unknown };
    const tripId = Number(body.trip_id);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      throw new AppError(400, 'Nieprawidłowy identyfikator wycieczki');
    }

    const trip = db
      .prepare('SELECT id, user_id, group_id FROM trip WHERE id = ?')
      .get(tripId) as { id: number; user_id: number; group_id: number | null } | undefined;
    if (!trip) throw new AppError(404, 'Wycieczka nie znaleziona');
    if (trip.user_id !== userId) {
      throw new AppError(403, 'Tylko właściciel może cofnąć udostępnienie');
    }

    const shared = db
      .prepare('SELECT 1 FROM group_shared_trips WHERE group_id = ? AND trip_id = ?')
      .get(groupId, tripId);
    const linkedToGroup = trip.group_id === groupId;

    if (!shared && !linkedToGroup) {
      throw new AppError(404, 'Wycieczka nie jest udostępniona w tej grupie');
    }

    if (shared) {
      db.prepare('DELETE FROM group_shared_trips WHERE group_id = ? AND trip_id = ?').run(
        groupId,
        tripId
      );
    }
    if (linkedToGroup) {
      db.prepare('UPDATE trip SET group_id = NULL WHERE id = ?').run(tripId);
    }

    res.status(204).send();
  })
);

router.delete(
  '/:id/members/:userId',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const groupId = parseGroupId(req.params.id);
    assertMember(groupId, userId);

    const targetUserId = Number(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      throw new AppError(400, 'Nieprawidłowy identyfikator użytkownika');
    }

    const group = db
      .prepare('SELECT created_by FROM groups WHERE id = ?')
      .get(groupId) as { created_by: number } | undefined;
    if (!group) throw new AppError(404, 'Grupa nie znaleziona');
    if (group.created_by !== userId) {
      throw new AppError(403, 'Tylko twórca grupy może usuwać członków');
    }
    if (targetUserId === userId) {
      throw new AppError(400, 'Użyj opcji „Opuść grupę”, aby samemu opuścić grupę');
    }
    if (!isGroupMember(groupId, targetUserId)) {
      throw new AppError(404, 'Użytkownik nie należy do tej grupy');
    }

    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, targetUserId);
    res.status(204).send();
  })
);

router.post(
  '/:id/leave',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const groupId = parseGroupId(req.params.id);
    assertMember(groupId, userId);

    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
    res.status(204).send();
  })
);

router.get(
  '/:id/stats',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const groupId = parseGroupId(req.params.id);
    assertMember(groupId, userId);

    const group = db
      .prepare('SELECT id FROM groups WHERE id = ?')
      .get(groupId) as { id: number } | undefined;
    if (!group) throw new AppError(404, 'Grupa nie znaleziona');

    res.json({
      month: getGroupActivityStats(groupId, 'month'),
      year: getGroupActivityStats(groupId, 'year'),
    });
  })
);

router.get(
  '/:id',
  handler(async (req, res) => {
    const userId = requireUser(req).id;
    const groupId = parseGroupId(req.params.id);
    assertMember(groupId, userId);

    const group = db
      .prepare('SELECT id, name, invite_code, created_by FROM groups WHERE id = ?')
      .get(groupId) as (Group & { created_by: number }) | undefined;
    if (!group) throw new AppError(404, 'Grupa nie znaleziona');

    const member_count = (
      db
        .prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?')
        .get(groupId) as { c: number }
    ).c;

    const members = db
      .prepare(
        `SELECT u.id, u.username, u.name
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY u.name`
      )
      .all(groupId) as GroupMember[];

    const trips = getGroupTrips(groupId, userId);

    const detail: GroupDetail = {
      ...group,
      member_count,
      members,
      trips,
    };

    res.json(detail);
  })
);

export default router;
