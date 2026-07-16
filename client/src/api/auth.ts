import { apiFetch, handleResponse } from './client';

export interface AuthUser {
  id: number;
  username: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function register(
  username: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, name }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function getMe(): Promise<AuthUser> {
  const res = await apiFetch('/api/auth/me');
  return handleResponse<AuthUser>(res);
}
