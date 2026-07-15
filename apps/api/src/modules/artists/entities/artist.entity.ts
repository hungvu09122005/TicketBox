// apps/api/src/modules/artists/entities/artist.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Concert } from '../../concerts/entities/concert.entity';

@Entity('artists')
export class Artist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // Thêm dòng này để khớp với logic trong Service
  @Column({ name: 'avatar_object_key', nullable: true })
  avatarObjectKey!: string;

  @ManyToMany(() => Concert, (concert) => concert.artists)
  concerts!: Concert[];

  @Column({ nullable: true })
  shortBio!: string;


}
