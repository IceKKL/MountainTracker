import type {
  Group,
  GroupDetail,
  GroupMember,
  GroupTripSummary,
  GroupActivityStats,
} from '@mountain-tracker/shared';
import { apiFetch, handleResponse } from './client';

export type { Group, GroupDetail, GroupMember, GroupTripSummary, GroupActivityStats };

export async function getGroups(): Promise<Group[]> {
  const res = await apiFetch('/api/groups');
  return handleResponse<Group[]>(res);
}

export async function getGroup(id: number): Promise<GroupDetail> {
  const res = await apiFetch(`/api/groups/${id}`);
  return handleResponse<GroupDetail>(res);
}

export async function createGroup(name: string): Promise<Group> {
  const res = await apiFetch('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return handleResponse<Group>(res);
}

export async function joinGroup(invite_code: string): Promise<Group> {
  const res = await apiFetch('/api/groups/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code }),
  });
  return handleResponse<Group>(res);
}

export async function getGroupMembers(groupId: number): Promise<GroupMember[]> {
  const res = await apiFetch(`/api/groups/${groupId}/members`);
  return handleResponse<GroupMember[]>(res);
}

export async function shareTrip(groupId: number, trip_id: number): Promise<void> {
  const res = await apiFetch(`/api/groups/${groupId}/share-trip`, {
    method: 'POST',
    body: JSON.stringify({ trip_id }),
  });
  await handleResponse(res);
}

export async function unshareTrip(groupId: number, trip_id: number): Promise<void> {
  const res = await apiFetch(`/api/groups/${groupId}/share-trip`, {
    method: 'DELETE',
    body: JSON.stringify({ trip_id }),
  });
  await handleResponse(res);
}

export async function getGroupStats(groupId: number): Promise<GroupActivityStats> {
  const res = await apiFetch(`/api/groups/${groupId}/stats`);
  return handleResponse<GroupActivityStats>(res);
}

export async function leaveGroup(groupId: number): Promise<void> {
  const res = await apiFetch(`/api/groups/${groupId}/leave`, { method: 'POST' });
  await handleResponse(res);
}

export async function removeGroupMember(groupId: number, userId: number): Promise<void> {
  const res = await apiFetch(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
  await handleResponse(res);
}
