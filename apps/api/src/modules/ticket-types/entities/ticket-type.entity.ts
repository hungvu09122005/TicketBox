import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Check,
} from 'typeorm';
import { Concert } from '../../concerts/entities/concert.entity';

/**
 * TicketType entity — Blueprint §04-database-design
 * Critical constraint: sold_quantity + held_quantity ≤ total_quantity (enforced in DB + service logic).
 */
@Entity('ticket_types')
@Check('"sold_quantity" + "held_quantity" <= "total_quantity"')
export class TicketType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Concert, { nullable: false })
  @JoinColumn({ name: 'concert_id' })
  concert!: Concert;

  @Column({ name: 'concert_id' })
  concertId!: string;

  @Column({ length: 100 })
  name!: string; // e.g. 'GA', 'SVIP', 'VIP', 'CAT1'

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  price!: number;

  @Column({ name: 'total_quantity', default: 0 })
  totalQuantity!: number;

  /** Incremented when payment is CONFIRMED. Released to zero on order expiry/cancel. */
  @Column({ name: 'sold_quantity', default: 0 })
  soldQuantity!: number;

  /** Incremented on order creation (hold). Decremented on expiry/cancel OR moved to soldQuantity on payment. */
  @Column({ name: 'held_quantity', default: 0 })
  heldQuantity!: number;

  /** Max tickets a single user can purchase/hold in this ticket type. */
  @Column({ name: 'max_per_user', default: 4 })
  maxPerUser!: number;

  @Column({ name: 'sale_starts_at', type: 'timestamptz', nullable: true })
  saleStartsAt?: Date;

  @Column({ name: 'sale_ends_at', type: 'timestamptz', nullable: true })
  saleEndsAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
