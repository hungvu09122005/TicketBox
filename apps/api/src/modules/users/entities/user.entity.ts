import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn, // Cần cho yêu cầu soft-delete (nếu có)
  Index,
  ManyToMany,
  JoinTable,
  OneToMany
} from 'typeorm';
import { Role } from './role.entity';
import { Order } from '../../orders/entities/order.entity';

/**
 * User entity — Blueprint §04-database-design
 * Tích hợp đầy đủ cho xác thực và RBAC
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ length: 100 })
  name!: string;

  // Lưu hash password, không lưu plain text
  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  /**
   * Dùng để invalidate Redis Cache khi role/permission của user thay đổi.
   * Mỗi khi admin cập nhật quyền, tăng version này lên.
   */
  @Column({ name: 'permission_version', default: 1 })
  permissionVersion: number = 1;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean = true;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // --- RBAC Integration ---
  // Định nghĩa bảng trung gian user_roles theo Blueprint §06-rbac-design
  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({ 
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' }
  })
  roles!: Role[];

  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];
}