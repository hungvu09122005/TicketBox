import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
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
      userPermissions = await this.loadPermissionsFromDb(user.sub);
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

  private async loadPermissionsFromDb(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query<{ roles: any }[]>(
      `SELECT roles FROM users WHERE id = $1`,
      [userId],
    );

    if (!rows || rows.length === 0 || !rows[0].roles) {
      return [];
    }

    // roles from DB is a jsonb array
    const userRoles: Role[] = typeof rows[0].roles === 'string' ? JSON.parse(rows[0].roles) : rows[0].roles;

    const permissions = new Set<string>();
    for (const role of userRoles) {
      const rolePerms = ROLE_PERMISSIONS_MAPPING[role] || [];
      for (const p of rolePerms) {
        permissions.add(p);
      }
    }

    return Array.from(permissions);
  }
}
