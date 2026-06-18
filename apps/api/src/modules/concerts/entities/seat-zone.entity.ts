
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { Concert } from './concert.entity';
import { TicketType } from './ticket-type.entity';


@Entity('seat_zones')
export class SeatZone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string; // ví dụ: "Zone A"

  @Column({ name: 'svg_path', nullable: true })
  svgPath?: string;

  // Quan hệ với Concert
  @ManyToOne(() => Concert, (concert) => concert.seatZones)
  @JoinColumn({ name: 'concert_id' })
  concert!: Concert;

  @Column({ name: 'concert_id' })
  concertId!: string;

  @OneToOne(() => TicketType, (tt) => tt.seatZone)
  ticketType!: TicketType;
} 