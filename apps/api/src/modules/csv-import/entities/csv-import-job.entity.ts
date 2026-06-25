import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum CsvImportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  FAILED = 'FAILED',
}

@Entity('csv_import_jobs')
export class CsvImportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column({ name: 'concert_id' }) concertId!: string;
  @Column({ name: 'triggered_by' }) triggeredBy!: string; // userId
  @Column({ name: 'object_key' }) objectKey!: string; // MinIO key
  @Column({ type: 'enum', enum: CsvImportJobStatus, default: CsvImportJobStatus.PENDING }) status!: CsvImportJobStatus;
  @Column({ name: 'total_rows', default: 0 }) totalRows!: number;
  @Column({ name: 'success_rows', default: 0 }) successRows!: number;
  @Column({ name: 'error_rows', default: 0 }) errorRows!: number;
  @Column({ name: 'failure_reason', type: 'text', nullable: true }) failureReason?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
