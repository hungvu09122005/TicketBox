export const PERMISSIONS = {
  CONCERT_READ: 'concert:read',
  CONCERT_CREATE: 'concert:create',
  CONCERT_UPDATE: 'concert:update',
  ORDER_CREATE: 'order:create',
  ORDER_READ_OWN: 'order:read_own',
  ORDER_READ_ALL: 'order:read_all',
  TICKET_VIEW_OWN: 'ticket:view_own',
  TICKET_VALIDATE: 'ticket:validate',
  VIP_IMPORT: 'vip:import',
  AI_GENERATE_BIO: 'ai:generate_bio',
  RBAC_MANAGE: 'rbac:manage',
  REPORT_VIEW: 'report:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS_MAPPING: Record<string, Permission[]> = {
  AUDIENCE: [
    PERMISSIONS.CONCERT_READ,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_READ_OWN,
    PERMISSIONS.TICKET_VIEW_OWN,
  ],
  ORGANIZER: [
    PERMISSIONS.CONCERT_READ,
    PERMISSIONS.CONCERT_CREATE,
    PERMISSIONS.CONCERT_UPDATE,
    PERMISSIONS.ORDER_READ_ALL,
    PERMISSIONS.VIP_IMPORT,
    PERMISSIONS.AI_GENERATE_BIO,
    PERMISSIONS.REPORT_VIEW,
  ],
  CHECKIN_STAFF: [
    PERMISSIONS.CONCERT_READ,
    PERMISSIONS.TICKET_VALIDATE,
  ],
  SYSTEM_ADMIN: [
    PERMISSIONS.CONCERT_READ,
    PERMISSIONS.CONCERT_CREATE,
    PERMISSIONS.CONCERT_UPDATE,
    PERMISSIONS.ORDER_READ_OWN,
    PERMISSIONS.ORDER_READ_ALL,
    PERMISSIONS.TICKET_VIEW_OWN,
    PERMISSIONS.TICKET_VALIDATE,
    PERMISSIONS.VIP_IMPORT,
    PERMISSIONS.AI_GENERATE_BIO,
    PERMISSIONS.RBAC_MANAGE,
    PERMISSIONS.REPORT_VIEW,
  ],
};

export function getPermissionsForRoles(roles: string[] = []): Permission[] {
  const permissions = new Set<Permission>();

  for (const role of roles) {
    const mapped = ROLE_PERMISSIONS_MAPPING[role.toUpperCase()];
    if (mapped) {
      mapped.forEach((permission) => permissions.add(permission));
    }
  }

  return Array.from(permissions);
}

export function hasAnyPermission(userPermissions: string[], requiredPermissions: Permission[]): boolean {
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.some((permission) => userPermissions.includes(permission));
}
