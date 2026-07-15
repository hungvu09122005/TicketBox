import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UsersService } from './users.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly usersService: UsersService,
  ) {}

  async createRoleIfNotExists(name: string): Promise<Role> {
    const existingRole = await this.roleRepository.findOne({ where: { name } });
    if (existingRole) return existingRole;

    const newRole = this.roleRepository.create({ name });
    return await this.roleRepository.save(newRole);
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: { permissions: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Role | null> {
    return this.roleRepository.findOne({
      where: { id },
      relations: { permissions: true },
    });
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({ order: { name: 'ASC' } });
  }

  async assignPermissionToRole(roleName: string, permissionName: string) {
    const role = await this.roleRepository.findOne({ 
        where: { name: roleName },
        relations: ['permissions'] // Phải load mối quan hệ này lên
    });
    const permission = await this.permissionRepository.findOne({ where: { name: permissionName } });

    if (role && permission) {
        // Kiểm tra xem đã có quyền này chưa để tránh trùng lặp
        const hasPermission = role.permissions.some(p => p.name === permission.name);
        if (!hasPermission) {
            role.permissions.push(permission);
            await this.roleRepository.save(role);
        }
    }
  }

  async updateRolePermissions(roleId: string, permissionNames: string[], adminId: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: { permissions: true },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found.`);
    }

    const normalizedNames = Array.from(
      new Set(
        permissionNames
          .map((permission) => permission.trim())
          .filter((permission) => permission.length > 0),
      ),
    );

    const permissions = normalizedNames.length > 0
      ? await this.permissionRepository.find({
          where: { name: In(normalizedNames) },
          order: { name: 'ASC' },
        })
      : [];

    if (permissions.length !== normalizedNames.length) {
      const found = new Set(permissions.map((permission) => permission.name));
      const missing = normalizedNames.filter((permission) => !found.has(permission));
      throw new BadRequestException(`Invalid permission codes: ${missing.join(', ')}`);
    }

    role.permissions = permissions;
    await this.roleRepository.save(role);

    await this.usersService.refreshPermissionVersionsForRole(role.name, adminId);

    return {
      ...role,
      permissions,
    };
  }
}
