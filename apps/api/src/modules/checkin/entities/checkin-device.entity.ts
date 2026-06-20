import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DeviceStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

@Entity('checkin_devices')
export class CheckinDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'staff_id' })
  @Index()
  staffId!: string;

  @Column({ name: 'concert_id' })
  @Index()
  concertId!: string;

  @Column({ name: 'zone_id', nullable: true })
  zoneId?: string;

  @Column({ length: 100, nullable: true })
  gate?: string;

  @Column({
    type: 'enum',
    enum: DeviceStatus,
    default: DeviceStatus.ACTIVE,
  })
  status!: DeviceStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
