export interface RbacUserSummary {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  permissionVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RbacUsersPage {
  items: RbacUserSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface RbacRoleSummary {
  id: string;
  name: string;
  permissions: string[];
}

export interface RbacPermissionSummary {
  id: string;
  name: string;
}
