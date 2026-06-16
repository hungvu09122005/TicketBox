import { getPermissionsForRoles } from './permissions';

export const ADMIN_ACCESS_TOKEN_KEY = 'admin_access_token';
export const ADMIN_REFRESH_TOKEN_KEY = 'admin_refresh_token';

export interface JwtPayload {
  sub?: string;
  email?: string;
  roles?: string[];
  permissionVersion?: number;
}

export interface AdminSession {
  id: string;
  email: string;
  roles: string[];
  permissionVersion: number;
  permissions: string[];
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = JSON.parse(atob(padded));
    return json as JwtPayload;
  } catch {
    return null;
  }
}

export function buildAdminSessionFromToken(token: string, fallbackEmail = ''): AdminSession | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const roles = Array.isArray(payload.roles) ? payload.roles : [];

  return {
    id: payload.sub ?? '',
    email: payload.email ?? fallbackEmail,
    roles,
    permissionVersion: payload.permissionVersion ?? 0,
    permissions: getPermissionsForRoles(roles),
  };
}

export function readStoredAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
  if (!token) return null;

  return buildAdminSessionFromToken(token);
}

export function clearStoredAdminSession(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
}
