import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Logger } from 'nestjs-pino';
import { UsersRepository, CreateUserData } from './users.repository';
import { User } from './entities/user.entity';

/**
 * UsersService — application service layer for user data.
 * This is the ONLY exported surface of UsersModule.
 * Other modules (Auth, Admin) depend on this service, never on UsersRepository.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly logger: Logger,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async createUser(data: CreateUserData): Promise<User> {
    return this.usersRepository.create(data);
  }

  /**
   * Called by RBAC management when Admin changes a user's roles.
   * Increments permissionVersion to invalidate Redis permission cache.
   */
  async invalidatePermissionCache(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (user) {
      const cacheKey = `rbac:user:${userId}:v${user.permissionVersion}`;
      await this.cache.del(cacheKey);
      await this.usersRepository.incrementPermissionVersion(userId);
    }
  }

  async updateRoles(userId: string, roles: string[], adminId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const oldVersion = user.permissionVersion;

    // Update in DB (increments permission_version)
    await this.usersRepository.updateRoles(userId, roles);

    // Delete Redis cache for the old version
    const cacheKey = `rbac:user:${userId}:v${oldVersion}`;
    await this.cache.del(cacheKey);

    this.logger.log({
      msg: 'Audit: User roles updated',
      targetUserId: userId,
      adminId,
      oldRoles: user.roles,
      newRoles: roles,
      oldVersion,
      newVersion: oldVersion + 1,
    });

    return (await this.usersRepository.findById(userId))!;
  }
}
