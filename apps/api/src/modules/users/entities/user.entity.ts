import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';

/**
 * User entity — Blueprint §04-database-design
 * Belongs exclusively to UsersModule.
 * Other modules access user data ONLY through UsersService (exported from UsersModule).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 255 })
  @Index()
  email!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  /**
   * Incremented when Admin changes this user's role/permissions.
   * RbacGuard uses this to invalidate the Redis permission cache.
   */
  @Column({ name: 'permission_version', default: 1 })
  permissionVersion: number = 1;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean = true;

  @Column({ type: 'jsonb', default: ['Audience'] })
  roles: string[] = ['Audience'];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
