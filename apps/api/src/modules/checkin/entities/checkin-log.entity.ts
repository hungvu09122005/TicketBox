import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum CheckinMode { ONLINE = 'ONLINE', OFFLINE = 'OFFLINE' }
export enum CheckinStatus { SUCCESS = 'SUCCESS', ALREADY_USED = 'ALREADY_USED', CONFLICT = 'CONFLICT', REJECTED = 'REJECTED' }

@Entity('checkin_logs')
export class CheckinLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id' })
  @Index()
  ticketId!: string;

  @Column({ name: 'staff_id' })
  staffId!: string;

  @Column({ name: 'device_id', length: 200 })
  deviceId!: string;

  @Column({ type: 'enum', enum: CheckinMode })
  mode!: CheckinMode;

  @Column({ type: 'enum', enum: CheckinStatus })
  status!: CheckinStatus;

  /** Unique per offline scan — prevents double-processing on sync. */
  @Column({ name: 'client_event_id', unique: true })
  clientEventId!: string;

  @Column({ name: 'scanned_at', type: 'timestamptz' })
  scannedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
