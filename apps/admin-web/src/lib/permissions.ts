export const Permission = {
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
