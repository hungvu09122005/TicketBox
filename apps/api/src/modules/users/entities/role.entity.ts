import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Permission } from './permission.entity';
import { User } from './user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string; // Thêm !

  @Column({ unique: true })
  name!: string; // Thêm !

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({ name: 'role_permissions' })
  permissions!: Permission[]; // Thêm !

  @ManyToMany(() => User, (user) => user.roles)
  users!: User[]; // Thêm !
}