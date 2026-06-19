import { 
  Entity, PrimaryGeneratedColumn, Column, ManyToMany, 
  CreateDateColumn, UpdateDateColumn 
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

  @ManyToMany(() => Concert, (concert) => concert.artists)
  concerts!: Concert[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}