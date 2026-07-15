export enum Permission {

  // Concert
  CONCERT_READ_PUBLIC = 'concert:read_public',
  CONCERT_READ_OWN = 'concert:read_own',
  CONCERT_READ_ALL = 'concert:read_all',
  CONCERT_CREATE = 'concert:create',
  CONCERT_UPDATE_OWN = 'concert:update_own',
  CONCERT_UPDATE_ALL = 'concert:update_all',
  CONCERT_PUBLISH_OWN = 'concert:publish_own',
  CONCERT_PUBLISH_ALL = 'concert:publish_all',
  CONCERT_CANCEL_OWN = 'concert:cancel_own',
  CONCERT_CANCEL_ALL = 'concert:cancel_all',

  // Artist

  ARTIST_READ = 'artist:read',
  ARTIST_CREATE = 'artist:create',
  ARTIST_UPDATE = 'artist:update',
  ARTIST_DELETE = 'artist:delete',

  VENUE_READ = 'venue:read',
  VENUE_CREATE = 'venue:create',
  VENUE_UPDATE = 'venue:update',
  VENUE_DELETE = 'venue:delete',
  TICKET_TYPE_READ = 'ticket_type:read',
  TICKET_TYPE_CREATE = 'ticket_type:create',
  TICKET_TYPE_UPDATE = 'ticket_type:update',
  TICKET_TYPE_DELETE = 'ticket_type:delete',
  SEATMAP_READ = 'seatmap:read',
  SEATMAP_UPDATE = 'seatmap:update',
  SEATMAP_UPLOAD = 'seatmap:upload',

  // Order & Ticket
  ORDER_CREATE = 'order:create',
  ORDER_READ_OWN = 'order:read_own',
  ORDER_READ_ALL = 'order:read_all',
  ORDER_REFUND = 'order:refund',
  TICKET_VIEW_OWN = 'ticket:view_own',
  TICKET_VALIDATE = 'ticket:validate',

  // VIP / AI / Report
  VIP_IMPORT = 'vip:import',
  AI_GENERATE_BIO = 'ai:generate_bio',
  REPORT_VIEW = 'report:view',
  REPORT_EXPORT = 'report:export',


  // RBAC / User

  USER_READ_OWN = 'user:read_own',
  USER_UPDATE_OWN = 'user:update_own',
  ROLE_UPDATE_PERMISSIONS = 'role:update_permissions',
  PERMISSION_READ = 'permission:read',
  PERMISSION_CREATE = 'permission:create',
  RBAC_MANAGE = 'rbac:manage',
}
