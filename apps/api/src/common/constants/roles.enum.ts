/**
 * Canonical role names — must match the `roles` table seeds.
 * Blueprint §06-rbac-design
 */
export enum Role {
  AUDIENCE = 'AUDIENCE',
  ORGANIZER = 'ORGANIZER',
  CHECKIN_STAFF = 'CHECKIN_STAFF',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}
