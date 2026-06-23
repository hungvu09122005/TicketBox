import { Ticket } from '@modules/tickets/entities/ticket.entity';
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index, OneToMany, ManyToOne, JoinColumn
} from 'typeorm';

// CHỈ CẦN DÒNG IMPORT NÀY, XÓA BỎ ĐOẠN ĐỊNH NGHĨA ENUM BÊN DƯỚI
import { OrderStatus } from '../enums/order-status.enum';
import { User } from '../../users/entities/user.entity';

@Entity('orders')
@Index(['userId', 'status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ name: 'concert_id' })
  concertId!: string;

  @Column({ name: 'ticket_type_id' })
  ticketTypeId!: string;

  @Column({ name: 'quantity' })
  quantity!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, name: 'total_amount' })
  totalAmount!: number;

  /** Hold expires at this time. bullMQ delayed job checks this. */
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.order)
  tickets!: Ticket[];

  @Column({
    type: 'enum',
    enum: OrderStatus, // Bây giờ nó dùng OrderStatus từ import
    default: OrderStatus.PENDING_PAYMENT,
  })
  status!: OrderStatus;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' }) 
  user!: User;
}