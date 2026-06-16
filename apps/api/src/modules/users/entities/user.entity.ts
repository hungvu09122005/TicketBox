import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * User entity — Blueprint §04-database-design
 * Belongs exclusively to UsersModule.
 * Other modules access user data ONLY through UsersService.
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
  permissionVersion!: number;

  @Column({ default: true, name: 'is_active' })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // --- RBAC Integration ---
  
  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({ 
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' }
  })
  roles!: Role[];
}