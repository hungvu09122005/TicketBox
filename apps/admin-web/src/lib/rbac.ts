import { Permission } from './permissions';

export type RbacRole = 'AUDIENCE' | 'ORGANIZER' | 'CHECKIN_STAFF' | 'SYSTEM_ADMIN';

export interface RoleOption {
  code: RbacRole;
  label: string;
  description: string;
  permissions: string[];
}

export const roleOptions: RoleOption[] = [
  {
    code: 'AUDIENCE',
    label: 'Audience',
    description: 'Xem concert, tạo order, xem vé cá nhân.',
    permissions: [
      Permission.CONCERT_READ,
      Permission.ORDER_CREATE,
      Permission.ORDER_READ_OWN,
      Permission.TICKET_VIEW_OWN,
    ],
  },
  {
    code: 'ORGANIZER',
    label: 'Organizer',
    description: 'Quản lý concert, ticket types, báo cáo và import khách VIP.',
    permissions: [
      Permission.CONCERT_READ,
      Permission.CONCERT_CREATE,
      Permission.CONCERT_UPDATE,
      Permission.ORDER_READ_ALL,
      Permission.VIP_IMPORT,
      Permission.AI_GENERATE_BIO,
      Permission.REPORT_VIEW,
    ],
  },
  {
    code: 'CHECKIN_STAFF',
    label: 'Check-in Staff',
    description: 'Quét QR và đồng bộ check-in.',
    permissions: [
      Permission.CONCERT_READ,
      Permission.TICKET_VALIDATE,
    ],
  },
  {
    code: 'SYSTEM_ADMIN',
    label: 'System Admin',
    description: 'Quản lý user, role, permission và toàn bộ quyền hệ thống.',
    permissions: [
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
  },
];

export const roleOrder: RbacRole[] = roleOptions.map((option) => option.code);

