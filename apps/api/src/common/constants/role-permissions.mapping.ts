import { Permission } from './permissions.enum';
import { Role } from './roles.enum';

export const ROLE_PERMISSIONS_MAPPING: Record<Role, Permission[]> = {
  [Role.AUDIENCE]: [
    Permission.CONCERT_READ_PUBLIC,
    Permission.ORDER_CREATE,
    Permission.ORDER_READ_OWN,
    Permission.TICKET_VIEW_OWN,
  ],
  [Role.ORGANIZER]: [
    Permission.CONCERT_READ_PUBLIC,
    Permission.CONCERT_READ_OWN,
    Permission.CONCERT_CREATE,
    Permission.CONCERT_UPDATE_OWN,
    Permission.CONCERT_PUBLISH_OWN,
    Permission.CONCERT_CANCEL_OWN,
    Permission.ARTIST_READ,
    Permission.ARTIST_CREATE,
    Permission.ARTIST_UPDATE,
    Permission.VENUE_READ,
    Permission.VENUE_CREATE,
    Permission.VENUE_UPDATE,
    Permission.TICKET_TYPE_READ,
    Permission.TICKET_TYPE_CREATE,
    Permission.TICKET_TYPE_UPDATE,
    Permission.SEATMAP_READ,
    Permission.SEATMAP_UPDATE,
    Permission.SEATMAP_UPLOAD,
    Permission.ORDER_READ_ALL,
    Permission.ORDER_REFUND,
    Permission.VIP_IMPORT,
    Permission.AI_GENERATE_BIO,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
  ],
  [Role.CHECKIN_STAFF]: [
    Permission.CONCERT_READ_PUBLIC,
    Permission.TICKET_VALIDATE,
  ],
  [Role.SYSTEM_ADMIN]: Object.values(Permission), // Admin có tất cả
};