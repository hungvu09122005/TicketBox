import { apiClient } from '../api-client';
import type { AdminProfile } from '../auth.types';

export interface UpdateRolesPayload {
  roles: string[];
}

export interface UpdateActiveStatusPayload {
  isActive: boolean;
}

export const userService = {
  updateRoles: async (userId: string, payload: UpdateRolesPayload): Promise<AdminProfile> => {
    const response = await apiClient.patch(`/users/${userId}/roles`, payload);
    return response.data.data;
  },

  updateActiveStatus: async (userId: string, payload: UpdateActiveStatusPayload): Promise<AdminProfile> => {
    const response = await apiClient.patch(`/users/${userId}/active`, payload);
    return response.data.data;
  },
};
