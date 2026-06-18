import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity'; // Import thêm Entity Permission

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission) // Inject thêm Repository của Permission
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async createRoleIfNotExists(name: string): Promise<Role> {
    const existingRole = await this.roleRepository.findOne({ where: { name } });
    if (existingRole) return existingRole;
    
    const newRole = this.roleRepository.create({ name });
    return await this.roleRepository.save(newRole);
  }

  // Hàm này giúp bạn gán quyền (vd: 'concert:create') cho Role (vd: 'Admin')
  async assignPermissionToRole(roleName: string, permissionCode: string) {
    const role = await this.roleRepository.findOne({ 
        where: { name: roleName },
        relations: ['permissions'] // Phải load mối quan hệ này lên
    });
    const permission = await this.permissionRepository.findOne({ where: { code: permissionCode } });

    if (role && permission) {
        // Kiểm tra xem đã có quyền này chưa để tránh trùng lặp
        const hasPermission = role.permissions.some(p => p.code === permission.code);
        if (!hasPermission) {
            role.permissions.push(permission);
            await this.roleRepository.save(role);
        }
    }
  }
}