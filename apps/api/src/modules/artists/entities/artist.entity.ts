import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Concert } from '../../concerts/entities/concert.entity';

@Entity('artists')
export class Artist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  shortBio?: string;

  @Column({ name: 'avatar_object_key', nullable: true })
  avatarObjectKey?: string;

  @OneToMany(() => Concert, (c) => c.artist)
  concerts!: Concert[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
