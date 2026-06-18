import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum CheckinMode { 
  ONLINE = 'ONLINE', 
  OFFLINE = 'OFFLINE', 
  SYNCED = 'SYNCED' 
}

export enum CheckinStatus { 
  ACCEPTED = 'ACCEPTED', 
  REJECTED = 'REJECTED', 
  CONFLICT = 'CONFLICT' 
}

@Entity('checkin_logs')
// AC: Index ticket_id + scanned_at để truy vấn nhanh lịch sử quét
@Index(['ticketId', 'scannedAt'])
// AC: Unique client_event_id trên thiết bị (Kết hợp để đảm bảo tính duy nhất)
@Index(['clientEventId', 'deviceId'], { unique: true })
export class CheckinLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id' })
  ticketId!: string;

  @Column({ name: 'staff_id', nullable: true })
  staffId?: string;

  @Column({ name: 'device_id', length: 200 })
  deviceId!: string;

  @Column({ type: 'enum', enum: CheckinMode, default: CheckinMode.ONLINE })
  mode!: CheckinMode;

  @Column({ type: 'enum', enum: CheckinStatus })
  status!: CheckinStatus;

  /** Lý do nếu status là CONFLICT */
  @Column({ name: 'conflict_reason', nullable: true })
  conflictReason?: string;

  /** Unique per offline scan — prevents double-processing on sync. */
  @Column({ name: 'client_event_id' })
  clientEventId!: string;

  @Column({ name: 'scanned_at', type: 'timestamptz' })
  scannedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'sync_at', type: 'timestamptz', nullable: true })
  syncAt?: Date;
}