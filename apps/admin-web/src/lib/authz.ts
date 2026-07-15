import type { AdminProfile } from './auth.types';

const allowedAdminRoles = new Set(['ORGANIZER', 'SYSTEM_ADMIN']);

export function hasAdminAccess(profile: Pick<AdminProfile, 'roles'> | null | undefined): boolean {
  if (!profile?.roles?.length) {
    return false;
  }

  return profile.roles.some((role) => allowedAdminRoles.has(role));
}
