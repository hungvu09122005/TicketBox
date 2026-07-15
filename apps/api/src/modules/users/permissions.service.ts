// src/modules/users/permissions.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.permissionRepository.find({
      order: { name: 'ASC' },
    });
  }

  async createPermissionIfNotExists(name: string): Promise<Permission> {
    const normalized = name.trim();
    const existing = await this.permissionRepository.findOne({
      where: [{ name: normalized }, { code: normalized }],
    });
    if (existing) return existing;

    const newPerm = this.permissionRepository.create({ name: normalized, code: normalized });
    return await this.permissionRepository.save(newPerm);
  }
}
