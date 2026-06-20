import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Logger } from 'nestjs-pino';
import { UsersRepository, CreateUserData, FindUsersOptions, FindUsersResult } from './users.repository';
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

  async findMany(options: FindUsersOptions = {}): Promise<FindUsersResult> {
    return this.usersRepository.findMany(options);
  }

  /**
   * Called by RBAC management when Admin changes a user's roles.
   * Increments permissionVersion to invalidate Redis permission cache.
   */
  async invalidatePermissionCache(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (user) {
      await this.invalidatePermissionCaches([user]);
    }
  }

  async refreshPermissionVersionsForRole(roleName: string, adminId: string): Promise<void> {
    const users = await this.usersRepository.findManyByRoleName(roleName);
    await this.invalidatePermissionCaches(users);

    this.logger.log({
      msg: 'Audit: Permission version refreshed for role',
      roleName,
      adminId,
      affectedUserIds: users.map((user) => user.id),
      affectedCount: users.length,
    });
  }

  async updateRoles(userId: string, roles: string[], adminId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Update in DB (increments permission_version)
    await this.usersRepository.updateRoles(userId, roles);
    await this.invalidatePermissionCaches([user]);

    this.logger.log({
      msg: 'Audit: User roles updated',
      targetUserId: userId,
      adminId,
      oldRoles: user.roles,
      newRoles: roles,
      oldVersion: user.permissionVersion,
      newVersion: user.permissionVersion + 1,
    });

    return (await this.usersRepository.findById(userId))!;
  }

  async updateActiveStatus(userId: string, isActive: boolean, adminId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const updatedUser = await this.usersRepository.updateActiveStatus(userId, isActive);
    if (!updatedUser) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    this.logger.log({
      msg: 'Audit: User active status updated',
      targetUserId: userId,
      adminId,
      oldIsActive: user.isActive,
      newIsActive: isActive,
    });

    return updatedUser;
  }

  private async invalidatePermissionCaches(users: User[]): Promise<void> {
    if (users.length === 0) {
      return;
    }

    await Promise.all(
      users.map(async (user) => {
        const cacheKey = `rbac:user:${user.id}:v${user.permissionVersion}`;
        await this.cache.del(cacheKey);
      }),
    );

    await this.usersRepository.incrementPermissionVersionsByIds(users.map((user) => user.id));
  }
}
