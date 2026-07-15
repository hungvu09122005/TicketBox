export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissionVersion: number;
  permissions: string[];
  isActive: boolean;
}
