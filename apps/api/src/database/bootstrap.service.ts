import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RolesService } from '../modules/users/roles.service';
import { PermissionsService } from '../modules/users/permissions.service';
import { UsersService } from '../modules/users/users.service';
import { Permission } from '../common/constants/permissions.enum';
import { Role } from '../common/constants/roles.enum';
import { ROLE_PERMISSIONS_MAPPING } from '../common/constants/role-permissions.mapping';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    this.logger.log('Bắt đầu đồng bộ RBAC từ Mapping...');
    
    // 1. Đồng bộ Roles
    for (const roleName of Object.values(Role)) {
      await this.rolesService.createRoleIfNotExists(roleName);
    }

    // 2. Đồng bộ Permissions
    await this.ensurePermissionsExist();

    // 3. Đồng bộ mapping role-permission vào DB
    const changedRoles = await this.ensureRolePermissionMapping();

    if (changedRoles.length > 0) {
      for (const roleName of changedRoles) {
        await this.usersService.refreshPermissionVersionsForRole(roleName, 'bootstrap');
      }
    }

    this.logger.log('RBAC bootstrap sync hoàn tất.');
  }

  private async ensurePermissionsExist() {
    for (const permission of Object.values(Permission)) {
      await this.permissionsService.createPermissionIfNotExists(permission);
    }
  }

  private async ensureRolePermissionMapping(): Promise<Role[]> {
    const existingRoles = await this.rolesService.findAll();
    const roleByName = new Map(existingRoles.map((role) => [role.name, role] as const));
    const changedRoles: Role[] = [];
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS_MAPPING)) {
      const existingRole = roleByName.get(roleName);
      const currentPermissionNames = new Set(
        existingRole?.permissions?.map((permission) => permission.name) ?? [],
      );
      const targetPermissionNames = new Set(permissions);
      const hasChanges =
        currentPermissionNames.size !== targetPermissionNames.size ||
        Array.from(targetPermissionNames).some((permission) => !currentPermissionNames.has(permission));

      for (const permission of permissions) {
        await this.rolesService.assignPermissionToRole(roleName as Role, permission);
      }

      if (hasChanges) {
        changedRoles.push(roleName as Role);
      }
    }

    return changedRoles;
  }
}
