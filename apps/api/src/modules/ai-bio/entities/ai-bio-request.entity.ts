import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AiBioStatus { PENDING = 'PENDING', PROCESSING = 'PROCESSING', DRAFT = 'DRAFT', PUBLISHED = 'PUBLISHED', FAILED = 'FAILED' }

@Entity('ai_bio_requests')
export class AiBioRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'artist_id' }) @Index() artistId!: string;
  @Column({ name: 'requested_by' }) requestedBy!: string;
  @Column({ name: 'pdf_object_key', nullable: true }) pdfObjectKey?: string;
  @Column({ type: 'enum', enum: AiBioStatus, default: AiBioStatus.PENDING }) status!: AiBioStatus;
  @Column({ name: 'draft_content', type: 'text', nullable: true }) draftContent?: string;
  @Column({ name: 'failure_reason', type: 'text', nullable: true }) failureReason?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
