import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { TicketType } from '../../ticket-types/entities/ticket-type.entity';

export enum TicketStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  CANCELLED = 'CANCELLED',
  TRANSFERRED = 'TRANSFERRED',
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id' })
  @Index()
  orderId!: string;

  @Column({ name: 'ticket_type_id' })
  ticketTypeId!: string;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ name: 'concert_id' })
  concertId!: string;

  /** HMAC-signed opaque token — contains ticketId+concertId, no PII. */
  @Column({ name: 'qr_token', unique: true })
  qrToken!: string;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.ACTIVE })
  status!: TicketStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Order, (order) => order.tickets)
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @ManyToOne(() => TicketType)
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType!: TicketType;

  @Column({
  name: 'manual_code',
  unique: true,
  length: 12,
  })
  @Index()
  manualCode!: string;
}
