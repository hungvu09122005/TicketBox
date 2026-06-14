import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

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
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: CreateUserData): Promise<User> {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async incrementPermissionVersion(userId: string): Promise<void> {
    await this.repo.increment({ id: userId }, 'permissionVersion', 1);
  }
}
