import { Role } from './roles.enum';
import { Permission } from './permissions.enum';

/**
 * Static mapping of Roles to Permissions based on Blueprint §06-rbac-design.
 * Since we simplified the schema to use `roles: jsonb` on the users table 
 * instead of normalized `user_roles` and `role_permissions` tables,
 * this mapping serves as the in-memory fallback during a Redis cache miss.
 */
export const ROLE_PERMISSIONS_MAPPING: Record<Role, Permission[]> = {
  [Role.AUDIENCE]: [
    Permission.CONCERT_READ,
    Permission.ORDER_CREATE,
    Permission.ORDER_READ_OWN,
    Permission.TICKET_VIEW_OWN,
  ],
  [Role.ORGANIZER]: [
    Permission.CONCERT_READ,
    Permission.CONCERT_CREATE,
    Permission.CONCERT_UPDATE,
    Permission.ORDER_READ_ALL,
    Permission.VIP_IMPORT,
    Permission.AI_GENERATE_BIO,
    Permission.REPORT_VIEW,
  ],
  [Role.CHECKIN_STAFF]: [
    Permission.CONCERT_READ,
    Permission.TICKET_VALIDATE,
  ],
  [Role.SYSTEM_ADMIN]: [
    Permission.CONCERT_READ,
    Permission.CONCERT_CREATE,
    Permission.CONCERT_UPDATE,
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.TICKET_VIEW_OWN,
    Permission.TICKET_VALIDATE,
    Permission.VIP_IMPORT,
    Permission.AI_GENERATE_BIO,
    Permission.RBAC_MANAGE,
    Permission.REPORT_VIEW,
  ],
};
