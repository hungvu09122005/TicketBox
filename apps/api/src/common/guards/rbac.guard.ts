import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../constants/permissions.enum';
import { Role } from '../constants/roles.enum';
import { ROLE_PERMISSIONS_MAPPING } from '../constants/role-permissions.mapping';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * RBAC Guard — Blueprint §06-rbac-design §4.2
 *
 * Authorization flow per request:
 *   1. Read required permissions from route metadata (@RequirePermissions).
 *   2. Resolve user's permissions via Redis cache keyed by userId + permissionVersion.
 *   3. On cache miss: query PostgreSQL users -> roles -> map to permissions.
 *   4. Compare required vs. actual permissions.
 *   5. Return 403 Forbidden if insufficient.
 *
 * This guard is applied AFTER JwtAuthGuard (user is already on request).
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermissions → route is public (still protected by JwtAuthGuard if applied)
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }

    const cacheKey = `rbac:user:${user.sub}:v${user.permissionVersion}`;
    let userPermissions: string[] | undefined = await this.cache.get<string[]>(cacheKey);

    if (!userPermissions) {
      // Cache miss — load from PostgreSQL and map to permissions
      const { permissions, permissionVersion } = await this.loadUserAndPermissionsFromDb(user.sub);
      
      if (permissionVersion > user.permissionVersion) {
        throw new UnauthorizedException('Token permissions expired. Please login again.');
      }

      userPermissions = permissions;
      // Cache for ~5 minutes; immediate invalidation happens on RBAC change via cache.del()
      await this.cache.set(cacheKey, userPermissions, 300_000);
    }

    const hasAll = required.every((perm) => userPermissions!.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${required.join(', ')}`,
      );
    }

    return true;
  }

  private async loadUserAndPermissionsFromDb(userId: string): Promise<{ permissions: string[], permissionVersion: number }> {
    const rows = await this.dataSource.query<{ permission_version: number, permission_name: string }[]>(
      `
      SELECT u.permission_version, p.name AS permission_name
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = $1
      `,
      [userId],
    );

    if (!rows || rows.length === 0) {
      return { permissions: [], permissionVersion: 0 };
    }
    
    const permissionVersion = rows[0].permission_version;
    const permissions = new Set<string>();
    
    for (const row of rows) {
      if (row.permission_name) {
        permissions.add(row.permission_name);
      }
    }

    return { permissions: Array.from(permissions), permissionVersion };
  }
}
