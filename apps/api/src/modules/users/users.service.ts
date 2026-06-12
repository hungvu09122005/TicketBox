import { Injectable } from '@nestjs/common';
import { UsersRepository, CreateUserData } from './users.repository';
import { User } from './entities/user.entity';

/**
 * UsersService — application service layer for user data.
 * This is the ONLY exported surface of UsersModule.
 * Other modules (Auth, Admin) depend on this service, never on UsersRepository.
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

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
    await this.usersRepository.incrementPermissionVersion(userId);
  }
}
