import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, { nullable: false })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'order_id' })
  orderId!: string;

  @Column({ name: 'ticket_type_id' })
  ticketTypeId!: string;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, name: 'unit_price' })
  unitPrice!: number;
}
