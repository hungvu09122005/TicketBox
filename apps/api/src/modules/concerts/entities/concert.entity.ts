import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index, ManyToMany, JoinTable, OneToMany,
} from 'typeorm';
import { Artist } from '../../artists/entities/artist.entity';
<<<<<<< HEAD
import { SeatZone } from '../../seat-map/entities/seat-zone.entity';
=======
import { SeatZone } from './seat-zone.entity';

>>>>>>> 94c0007 (feat(rbac): finish RBAC migration, seeding, and controller permissions)
export enum ConcertStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Entity('concerts')
export class Concert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 300 })
  name!: string;

  // Sử dụng ManyToMany với JoinTable
  @ManyToMany(() => Artist, (artist) => artist.concerts)
  @JoinTable({
    name: 'concert_artists', // Tên bảng trung gian
    joinColumn: { name: 'concert_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'artist_id', referencedColumnName: 'id' },
  })
  artists!: Artist[];

  @Column({ name: 'organizer_id' })
  organizerId!: string;

  @Column({ type: 'enum', enum: ConcertStatus, default: ConcertStatus.DRAFT })
  @Index()
  status!: ConcertStatus;

  @Column({ type: 'timestamptz', name: 'starts_at' })
  @Index()
  startsAt!: Date;

  @Column({ type: 'timestamptz', name: 'ends_at' })
  endsAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SeatZone, (seatZone) => seatZone.concert)
  seatZones!: SeatZone[];
}