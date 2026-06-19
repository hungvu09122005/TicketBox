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
import { User } from '../../modules/users/entities/user.entity';

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
    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: { roles: { permissions: true } },
    });

    if (!user) {
      return { permissions: [], permissionVersion: 0 };
    }

    const permissions = new Set<string>();

    for (const role of user.roles ?? []) {
      const blueprintPermissions = ROLE_PERMISSIONS_MAPPING[role.name as Role];
      if (blueprintPermissions) {
        blueprintPermissions.forEach((permission) => permissions.add(permission));
        continue;
      }

      for (const permission of role.permissions ?? []) {
        permissions.add(permission.name as Permission);
      }
    }

    return {
      permissions: Array.from(permissions),
      permissionVersion: user.permissionVersion,
    };
  }
}
