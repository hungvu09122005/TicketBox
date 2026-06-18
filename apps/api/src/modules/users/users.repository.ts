import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
  roles?: string[];
}

/**
 * UsersRepository — data access layer for UsersModule.
 * ONLY UsersService calls this. No other module accesses it.
 */
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
      relations: { roles: true },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: { roles: true },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    let roleEntities: Role[] = [];
    if (data.roles && data.roles.length > 0) {
      roleEntities = await this.repo.manager
        .createQueryBuilder(Role, 'role')
        .where('role.name IN (:...roles)', { roles: data.roles })
        .getMany();
    }

    const user = this.repo.create({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      roles: roleEntities,
    });

    return this.repo.save(user);
  }

  async incrementPermissionVersion(userId: string): Promise<void> {
    await this.repo.increment({ id: userId }, 'permissionVersion', 1);
  }

  async updateRoles(userId: string, roles: string[]): Promise<void> {
    let roleEntities: Role[] = [];
    if (roles && roles.length > 0) {
      roleEntities = await this.repo.manager
        .createQueryBuilder(Role, 'role')
        .where('role.name IN (:...roles)', { roles })
        .getMany();
    }

    const user = await this.repo.findOne({ where: { id: userId } });
    if (user) {
      user.roles = roleEntities;
      user.permissionVersion += 1;
      await this.repo.save(user);
    }
  }
}
