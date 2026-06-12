import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';

export enum PaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id' })
  @Index()
  orderId!: string;

  /** Unique key per payment attempt — prevents duplicate payment requests. */
  @Column({ name: 'idempotency_key', unique: true })
  idempotencyKey!: string;

  /** Provider transaction ID — unique constraint prevents double-processing callbacks. */
  @Column({ name: 'provider_tx_id', unique: true, nullable: true })
  providerTxId?: string;

  @Column({ name: 'provider', length: 50 })
  provider!: string; // 'VNPAY' | 'MOMO'

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ type: 'jsonb', name: 'raw_callback', nullable: true })
  rawCallback?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
