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
