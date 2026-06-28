export interface AudienceProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissionVersion: number;
  permissions: string[];
  isActive: boolean;
}
