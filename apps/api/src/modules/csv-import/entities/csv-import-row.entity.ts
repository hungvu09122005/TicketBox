import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum CsvRowStatus { SUCCESS = 'SUCCESS', SKIPPED_DUPLICATE = 'SKIPPED_DUPLICATE', ERROR = 'ERROR' }

@Entity('csv_import_rows')
export class CsvImportRow {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'job_id' }) @Index() jobId!: string;
  @Column({ name: 'row_number' }) rowNumber!: number;
  @Column({ type: 'enum', enum: CsvRowStatus }) status!: CsvRowStatus;
  @Column({ name: 'error_reason', type: 'text', nullable: true }) errorReason?: string;
}
