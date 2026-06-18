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

  async createPermissionIfNotExists(name: string): Promise<Permission> {
    const existing = await this.permissionRepository.findOne({ where: { name } });
    if (existing) return existing;
    

    const newPerm = this.permissionRepository.create({ name });
    return await this.permissionRepository.save(newPerm);
  }
}
