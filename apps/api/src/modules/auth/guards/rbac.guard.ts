import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Lấy quyền yêu cầu từ Decorator (nếu có)
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    // Nếu API không yêu cầu quyền đặc biệt, cho qua
    if (!requiredPermissions) return true;

    // 2. Lấy user từ Request (được gán từ JwtAuthGuard trước đó)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Người dùng chưa đăng nhập');
    }

    // 3. Kiểm tra logic phân quyền
    // user.roles là mảng các Role, mỗi Role có mảng Permission
    const hasPermission = user.roles?.some((role: Role) =>
      role.permissions?.some((p: Permission) =>
        requiredPermissions.includes(p.name),
      ),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện hành động này (RBAC Access Denied)',
      );
    }

    return true;
  }
}