import { parseTripIdFromSlug } from '@mountain-tracker/shared';
import type { TripParticipantEntry, TripParticipantsResponse } from '@mountain-tracker/shared';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Trip } from '../types/trip.js';

export function isGroupMember(groupId: number, userId: number): boolean {
  const row = db
    .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId);
  return !!row;
}

export function getTripGroupIds(tripId: number): number[] {
  const trip = db
    .prepare('SELECT group_id FROM trip WHERE id = ?')
    .get(tripId) as { group_id: number | null } | undefined;
  const fromShared = db
    .prepare('SELECT group_id FROM group_shared_trips WHERE trip_id = ?')
    .all(tripId) as { group_id: number }[];

  const ids = new Set<number>();
  if (trip?.group_id != null) ids.add(trip.group_id);
  for (const row of fromShared) ids.add(row.group_id);
  return [...ids];
}

export function isGroupTrip(tripId: number): boolean {
  return getTripGroupIds(tripId).length > 0;
}

export function canAccessTrip(tripId: number, userId: number): boolean {
  const trip = db
    .prepare('SELECT user_id FROM trip WHERE id = ?')
    .get(tripId) as { user_id: number | null } | undefined;
  if (!trip) return false;
  if (trip.user_id === userId) return true;
  return getTripGroupIds(tripId).some((gid) => isGroupMember(gid, userId));
}

export function assertAssignedUserInTripGroups(
  tripId: number,
  assignedUserId: number
): void {
  const groupIds = getTripGroupIds(tripId);
  if (groupIds.length === 0) return;
  const ok = groupIds.some((gid) => isGroupMember(gid, assignedUserId));
  if (!ok) throw new AppError(400, 'Wybrany użytkownik nie należy do grupy wycieczki');
}

export function getEffectiveGroupId(tripId: number): number | null {
  const trip = db
    .prepare('SELECT group_id FROM trip WHERE id = ?')
    .get(tripId) as { group_id: number | null } | undefined;
  if (trip?.group_id != null) return trip.group_id;
  const shared = db
    .prepare('SELECT group_id FROM group_shared_trips WHERE trip_id = ? LIMIT 1')
    .get(tripId) as { group_id: number } | undefined;
  return shared?.group_id ?? null;
}

export function getAccessibleTrip(idSlug: string | string[], userId: number): Trip {
  const raw = Array.isArray(idSlug) ? idSlug[0] : idSlug;
  const id = parseTripIdFromSlug(raw);
  if (id === null) throw new AppError(400, 'Nieprawidłowy identyfikator wycieczki');

  const trip = db.prepare('SELECT * FROM trip WHERE id = ?').get(id) as Trip | undefined;
  if (!trip) throw new AppError(404, 'Wycieczka nie znaleziona');
  if (!canAccessTrip(trip.id, userId)) throw new AppError(404, 'Wycieczka nie znaleziona');

  const effectiveGroupId = getEffectiveGroupId(trip.id);

  return {
    ...trip,
    group_id: effectiveGroupId ?? trip.group_id ?? null,
    is_owner: trip.user_id === userId,
  };
}

export function getTripOrThrow(idSlug: string | string[], userId: number): Trip {
  const raw = Array.isArray(idSlug) ? idSlug[0] : idSlug;
  const id = parseTripIdFromSlug(raw);
  if (id === null) throw new AppError(400, 'Nieprawidłowy identyfikator wycieczki');
  const trip = db
    .prepare('SELECT * FROM trip WHERE id = ? AND user_id = ?')
    .get(id, userId) as Trip | undefined;
  if (!trip) throw new AppError(404, 'Wycieczka nie znaleziona');
  return { ...trip, is_owner: true };
}

export function assertTripOwner(trip: Trip, userId: number): void {
  if (trip.user_id !== userId) {
    throw new AppError(403, 'Tylko właściciel może wykonać tę operację');
  }
}

export function getTripParticipantsData(tripId: number): TripParticipantsResponse {
  const groupIds = getTripGroupIds(tripId);
  if (groupIds.length === 0) {
    return { joined_count: 0, total: 0, members: [] };
  }

  const placeholders = groupIds.map(() => '?').join(', ');
  const members = db
    .prepare(
      `SELECT DISTINCT u.id, u.username, u.name
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id IN (${placeholders})
       ORDER BY u.name`
    )
    .all(...groupIds) as { id: number; username: string; name: string }[];

  const participantRows = db
    .prepare('SELECT user_id, status FROM trip_participants WHERE trip_id = ?')
    .all(tripId) as { user_id: number; status: 'joined' | 'declined' }[];

  const statusByUser = new Map(participantRows.map((r) => [r.user_id, r.status]));

  const membersWithStatus: TripParticipantEntry[] = members.map((m) => ({
    ...m,
    status: statusByUser.get(m.id) ?? null,
  }));

  return {
    joined_count: membersWithStatus.filter((m) => m.status === 'joined').length,
    total: members.length,
    members: membersWithStatus,
  };
}

export function getTripJoinedCompanions(
  tripId: number,
  excludeUserId: number
): { id: number; username: string; name: string }[] {
  if (!isGroupTrip(tripId)) return [];
  return getTripParticipantsData(tripId)
    .members.filter((m) => m.status === 'joined' && m.id !== excludeUserId)
    .map(({ id, username, name }) => ({ id, username, name }));
}

export function getNextAccessiblePlannedTrip(userId: number): Trip | undefined {
  const row = db
    .prepare(
      `SELECT DISTINCT t.*,
        CASE WHEN t.user_id = ? THEN 1 ELSE 0 END as is_owner_flag
       FROM trip t
       LEFT JOIN group_shared_trips gst ON gst.trip_id = t.id
       LEFT JOIN group_members gm ON gm.group_id = gst.group_id AND gm.user_id = ?
       LEFT JOIN group_members gm2 ON gm2.group_id = t.group_id AND gm2.user_id = ?
       WHERE (t.user_id = ? OR gm.user_id IS NOT NULL OR gm2.user_id IS NOT NULL)
         AND t.status = 'planowana'
         AND t.date_start >= date('now')
         AND t.date_start != 'nieznana'
       ORDER BY t.date_start ASC, t.id ASC
       LIMIT 1`
    )
    .get(userId, userId, userId, userId) as (Trip & { is_owner_flag: number }) | undefined;

  if (!row) return undefined;
  const { is_owner_flag, ...trip } = row;
  return {
    ...trip,
    is_owner: is_owner_flag === 1,
    group_id: getEffectiveGroupId(trip.id) ?? trip.group_id ?? null,
  };
}

export function listAccessibleTrips(
  userId: number,
  status?: string
): Trip[] {
  let sql = `
    SELECT DISTINCT t.*,
      CASE WHEN t.user_id = ? THEN 1 ELSE 0 END as is_owner_flag
    FROM trip t
    LEFT JOIN group_shared_trips gst ON gst.trip_id = t.id
    LEFT JOIN group_members gm ON gm.group_id = gst.group_id AND gm.user_id = ?
    LEFT JOIN group_members gm2 ON gm2.group_id = t.group_id AND gm2.user_id = ?
    WHERE t.user_id = ? OR gm.user_id IS NOT NULL OR gm2.user_id IS NOT NULL
  `;
  const params: (string | number)[] = [userId, userId, userId, userId];

  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY t.date_start DESC, t.id DESC';

  const rows = db.prepare(sql).all(...params) as (Trip & { is_owner_flag: number })[];
  return rows.map(({ is_owner_flag, ...trip }) => ({
    ...trip,
    is_owner: is_owner_flag === 1,
    group_id: getEffectiveGroupId(trip.id) ?? trip.group_id ?? null,
  }));
}
