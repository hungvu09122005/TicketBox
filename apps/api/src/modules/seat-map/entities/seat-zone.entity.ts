import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Concert } from '../../concerts/entities/concert.entity';

/** Seat zone metadata — SVG file stored in Object Storage, key stored here. */
@Entity('seat_zones')
export class SeatZone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Concert, { nullable: false })
  @JoinColumn({ name: 'concert_id' })
  concert!: Concert;

  @Column({ name: 'concert_id' })
  concertId!: string;

  @Column({ length: 100 })
  name!: string; // e.g. 'Zone A', 'VIP Floor'

  /** Key of SVG file in Object Storage (MinIO) */
  @Column({ name: 'svg_object_key', nullable: true })
  svgObjectKey?: string;

  /** Linked ticket type for this zone */
  @Column({ name: 'ticket_type_id', nullable: true })
  ticketTypeId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
