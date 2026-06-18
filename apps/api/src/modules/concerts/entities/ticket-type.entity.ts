import { Entity, PrimaryGeneratedColumn, Column, Check, OneToOne } from 'typeorm';
import { SeatZone } from './seat-zone.entity';

@Entity('ticket_types')
@Check('price >= 0')
@Check('total_quantity >= 0')
@Check('max_per_user > 0')
export class TicketType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column('int', { name: 'total_quantity' })
  totalQuantity!: number;

  @Column('int', { name: 'sold_quantity', default: 0 })
  soldQuantity!: number;

  @Column('int', { name: 'held_quantity', default: 0 })
  heldQuantity!: number;

  @Column('int', { name: 'max_per_user' })
  maxPerUser!: number;

  @OneToOne(() => SeatZone, (sz) => sz.ticketType)
  seatZone!: SeatZone;
}