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
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * RBAC Guard — Blueprint §06-rbac-design §4.2
 *
 * Authorization flow per request:
 *   1. Read required permissions from route metadata (@RequirePermissions).
 *   2. Resolve user's permissions via Redis cache keyed by userId + permissionVersion.
 *   3. On cache miss: query PostgreSQL user_roles → role_permissions → permissions.
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
      // Cache miss — load from PostgreSQL
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
    // 1. Định nghĩa câu SQL khớp 100% với tên cột trong Database của bạn
    const sql = `
      SELECT DISTINCT p.code
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN role_permissions rp ON rp."rolesId" = ur.role_id
      JOIN permissions p ON p.id = rp."permissionsId"
      WHERE u.id = $1
    `;

    // 2. Thực thi query và xử lý lỗi
    try {
      // Lưu ý: TypeORM query trả về mảng các dòng
      const rows = await this.dataSource.query(sql, [userId]);
      
      // 3. Map kết quả sang mảng string code
      return rows.map((r: { code: string }) => r.code);
    } catch (error) {
      console.error('--- LỖI DB THỰC SỰ LÀ: ---', error);
      throw error; // Ném lỗi để hệ thống ghi log 500
    }
  }
}
