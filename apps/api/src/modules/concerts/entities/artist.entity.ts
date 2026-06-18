import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Concert } from './concert.entity';

@Entity('artists') 
export class Artist {
  @PrimaryGeneratedColumn('uuid')
  id!: string; 

  @Column()
  name!: string; 

  @Column({ type: 'text', nullable: true })
  description?: string; 

  @OneToMany(() => Concert, (concert) => concert.artist)
  concerts!: Concert[]; 
}