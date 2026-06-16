import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Artist } from '../../artists/entities/artist.entity';
import { SeatZone } from './seat-zone.entity';
export enum ConcertStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

/**
 * Concert entity — Blueprint §04-database-design
 * owned exclusively by ConcertsModule.
 */
@Entity('concerts')
export class Concert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 300 })
  name!: string;

  @ManyToOne(() => Artist, (a) => a.concerts, { nullable: false })
  @JoinColumn({ name: 'artist_id' })
  artist!: Artist;

  @Column({ name: 'artist_id' })
  artistId!: string;

  @Column({ name: 'organizer_id' })
  organizerId!: string; // Reference to users.id — ownership check in service

  @Column({
    type: 'enum',
    enum: ConcertStatus,
    default: ConcertStatus.DRAFT,
  })
  @Index()
  status!: ConcertStatus;

  @Column({ type: 'timestamptz', name: 'starts_at' })
  @Index()
  startsAt!: Date;

  @Column({ type: 'timestamptz', name: 'ends_at' })
  endsAt!: Date;

  @Column({ type: 'timestamptz', name: 'sale_starts_at', nullable: true })
  saleStartsAt?: Date;

  @Column({ type: 'timestamptz', name: 'sale_ends_at', nullable: true })
  saleEndsAt?: Date;

  @Column({ length: 500, nullable: true })
  venue?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'banner_object_key', nullable: true })
  bannerObjectKey?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SeatZone, (seatZone) => seatZone.concert)
  seatZones!: SeatZone[];
}
