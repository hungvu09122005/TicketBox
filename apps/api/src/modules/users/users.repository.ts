import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';

export interface FindUsersOptions {
  query?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface FindUsersResult {
  items: User[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
  roles?: string[];
  isActive?: boolean;
}

export interface UpdateOwnProfileData {
  name?: string;
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
      relations: ['roles'] // 
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: { roles: { permissions: true } },
    });
  }

  async findMany(options: FindUsersOptions = {}): Promise<FindUsersResult> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const query = options.query?.trim();
    const role = options.role?.trim();

    const qb = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .distinct(true)
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query) {
      qb.andWhere('(user.email ILIKE :query OR user.name ILIKE :query)', { query: `%${query}%` });
    }

    if (role) {
      qb.andWhere('role.name = :role', { role });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findManyByRoleName(roleName: string): Promise<User[]> {
    return this.repo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role', 'role.name = :roleName', { roleName })
      .getMany();
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
      isActive: data.isActive ?? false,
      roles: roleEntities,
    });

    return this.repo.save(user);
  }

  async incrementPermissionVersion(userId: string): Promise<void> {
    await this.repo.increment({ id: userId }, 'permissionVersion', 1);
  }

  async incrementPermissionVersionsByIds(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    await this.repo.increment({ id: In(userIds) }, 'permissionVersion', 1);
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

  async updateActiveStatus(userId: string, isActive: boolean): Promise<User | null> {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }

    user.isActive = isActive;
    return this.repo.save(user);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id: userId }, { passwordHash });
  }

  async updateOwnProfile(userId: string, data: UpdateOwnProfileData): Promise<User | null> {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }

    if (typeof data.name === 'string') {
      user.name = data.name.trim();
    }

    return this.repo.save(user);
  }
}
