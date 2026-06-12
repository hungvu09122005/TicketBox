import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to declare required permissions on a controller or route handler.
 * Used by RbacGuard.
 *
 * @example
 *   \@RequirePermissions(Permission.CONCERT_CREATE)
 *   createConcert() { ... }
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
