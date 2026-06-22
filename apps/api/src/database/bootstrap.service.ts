import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RolesService } from '../modules/users/roles.service';
import { PermissionsService } from '../modules/users/permissions.service';
<<<<<<< HEAD
import { Permission } from '../common/constants/permissions.enum';
import { Role } from '../common/constants/roles.enum';
import { ROLE_PERMISSIONS_MAPPING } from '../common/constants/role-permissions.mapping';
=======
import { ROLE_PERMISSIONS_MAPPING } from '../common/constants/role-permissions.mapping';
import { Role } from '../common/constants/roles.enum';
>>>>>>> 94c0007 (feat(rbac): finish RBAC migration, seeding, and controller permissions)

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService
  ) {}

  async onModuleInit() {
<<<<<<< HEAD
    this.logger.log('Khởi tạo dữ liệu hệ thống...');
    await this.ensureRolesExist();
    await this.ensurePermissionsExist();
    await this.ensureRolePermissionMapping();
  }

  private async ensureRolesExist() {
    const roles = Object.values(Role);
    for (const name of roles) {
      await this.rolesService.createRoleIfNotExists(name);
=======
    this.logger.log('Bắt đầu đồng bộ RBAC từ Mapping...');
    
    // 1. Đồng bộ Roles
    for (const roleName of Object.values(Role)) {
      await this.rolesService.createRoleIfNotExists(roleName);
>>>>>>> 94c0007 (feat(rbac): finish RBAC migration, seeding, and controller permissions)
    }
<<<<<<< HEAD
=======
  }
>>>>>>> feature/mysunday

<<<<<<< HEAD
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
=======
    // 2. Đồng bộ Permissions và gán vào Roles
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS_MAPPING)) {
      for (const permCode of permissions) {
        // Tạo permission (dùng code làm name tạm thời nếu chưa có name cụ thể)
        await this.permissionsService.createPermissionIfNotExists(permCode, permCode);
        
        // Gán quyền vào Role
        await this.rolesService.assignPermissionToRole(roleName, permCode);
      }
    }
    
    this.logger.log('RBAC Bootstrap hoàn tất! Hệ thống đã đồng bộ với ROLE_PERMISSIONS_MAPPING.');
  }
}
>>>>>>> 94c0007 (feat(rbac): finish RBAC migration, seeding, and controller permissions)
