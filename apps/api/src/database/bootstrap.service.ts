import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RolesService } from '../modules/users/roles.service';
import { PermissionsService } from '../modules/users/permissions.service';
import { Permission } from '../common/constants/permissions.enum';
import { Role } from '../common/constants/roles.enum';
import { ROLE_PERMISSIONS_MAPPING } from '../common/constants/role-permissions.mapping';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService
  ) {}

  async onModuleInit() {
    this.logger.log('Bắt đầu đồng bộ RBAC từ Mapping...');
    
    // 1. Đồng bộ Roles
    for (const roleName of Object.values(Role)) {
      await this.rolesService.createRoleIfNotExists(roleName);
    }
  }

  private async ensurePermissionsExist() {
    for (const permission of Object.values(Permission)) {
      await this.permissionsService.createPermissionIfNotExists(permission);
    }
  }

  private async ensureRolePermissionMapping() {
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS_MAPPING)) {
      for (const permission of permissions) {
        await this.rolesService.assignPermissionToRole(roleName as Role, permission);
      }
    }
  }
}
