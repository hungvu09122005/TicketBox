import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

export enum NotificationType { TICKET_CONFIRMATION = 'TICKET_CONFIRMATION', REMINDER_24H = 'REMINDER_24H', CONCERT_UPDATE = 'CONCERT_UPDATE', VIP_WELCOME = 'VIP_WELCOME' }
export enum NotificationChannel { EMAIL = 'EMAIL' }
export enum NotificationStatus { QUEUED = 'QUEUED', SENT = 'SENT', FAILED = 'FAILED', BOUNCED = 'BOUNCED' }

/** UNIQUE(ticketId, type, channel) prevents duplicate notification delivery. */
@Entity('notification_logs')
@Unique(['ticketId', 'type', 'channel'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'ticket_id' }) @Index() ticketId!: string;
  @Column({ name: 'user_id' }) userId!: string;
  @Column({ type: 'enum', enum: NotificationType }) type!: NotificationType;
  @Column({ type: 'enum', enum: NotificationChannel }) channel!: NotificationChannel;
  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.QUEUED }) status!: NotificationStatus;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true }) sentAt?: Date;
  @Column({ name: 'failure_reason', type: 'text', nullable: true }) failureReason?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
