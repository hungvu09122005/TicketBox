import { apiClient } from '../api-client';
import type {
  RbacPermissionSummary,
  RbacRoleSummary,
  RbacUsersPage,
} from '../rbac.types';

export interface ListUsersParams {
  query?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface UpdateRolePermissionsPayload {
  permissions: string[];
}

export interface CreatePermissionPayload {
  name: string;
}

export const rbacService = {
  getUsers: async (params: ListUsersParams = {}): Promise<RbacUsersPage> => {
    const response = await apiClient.get('/rbac/users', { params });
    return response.data.data;
  },

  getRoles: async (): Promise<RbacRoleSummary[]> => {
    const response = await apiClient.get('/rbac/roles');
    return response.data.data;
  },

  getPermissions: async (): Promise<RbacPermissionSummary[]> => {
    const response = await apiClient.get('/rbac/permissions');
    return response.data.data;
  },

  createPermission: async (payload: CreatePermissionPayload): Promise<RbacPermissionSummary> => {
    const response = await apiClient.post('/rbac/permissions', payload);
    return response.data.data;
  },

  updateRolePermissions: async (roleId: string, payload: UpdateRolePermissionsPayload): Promise<RbacRoleSummary> => {
    const response = await apiClient.patch(`/rbac/roles/${roleId}/permissions`, payload);
    return response.data.data;
  },
};
