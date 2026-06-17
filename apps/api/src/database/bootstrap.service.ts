// src/database/bootstrap.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RolesService } from '../modules/users/roles.service';
import { PermissionsService } from '../modules/users/permissions.service';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService
  ) {}

  async onModuleInit() {
    this.logger.log('Khởi tạo dữ liệu hệ thống...');
    await this.ensureRolesExist();
    await this.ensurePermissionsExist();
    
    // Ví dụ: Gán quyền mặc định cho Admin
    await this.rolesService.assignPermissionToRole('Admin', 'concert:create');
  }

  private async ensureRolesExist() {
    const roles = ['Admin', 'Audience', 'Organizer', 'Staff'];
    for (const name of roles) {
      await this.rolesService.createRoleIfNotExists(name);
    }
    this.logger.log('Roles đã sẵn sàng!');
  }

  private async ensurePermissionsExist() {
  const permissions = [
      { code: 'concert:create', name: 'Create Concert' },
      { code: 'ticket:book', name: 'Book Ticket' }
  ];
  
  for (const p of permissions) {
      // Truyền p.code (tham số 1) và p.name (tham số 2)
      await this.permissionsService.createPermissionIfNotExists(p.code, p.name);
  }
}
}