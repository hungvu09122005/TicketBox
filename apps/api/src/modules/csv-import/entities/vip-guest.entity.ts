import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

/**
 * VIP guest — unique by (concert_id, dedup_key) to prevent duplicate import.
 * dedup_key = normalize(email) or normalize(phone) scoped per concert.
 */
@Entity('vip_guests')
export class VipGuest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'concert_id' }) @Index() concertId!: string;
  @Column({ name: 'ticket_type_id' }) ticketTypeId!: string;
  @Column({ name: 'csv_import_job_id' }) csvImportJobId!: string;
  @Column({ length: 255 }) email!: string;
  @Column({ length: 50, nullable: true }) phone?: string;
  @Column({ length: 200 }) name!: string;
  /** UNIQUE (concertId, dedupKey) prevents duplicate VIP per concert. */
  @Column({ name: 'dedup_key', length: 255 })
  @Index()
  dedupKey!: string;
  @Column({ name: 'ticket_id', nullable: true }) ticketId?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
