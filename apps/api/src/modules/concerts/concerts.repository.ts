import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Concert, ConcertStatus } from './entities/concert.entity';

@Injectable()
export class ConcertsRepository {
  constructor(
    @InjectRepository(Concert)
    private readonly repo: Repository<Concert>,
  ) {}

  findPublished(): Promise<Concert[]> {
    return this.repo.find({
      where: { status: ConcertStatus.PUBLISHED },
      order: { startsAt: 'ASC' },
    });
  }

  findById(id: string): Promise<Concert | null> {
    return this.repo.findOne({ where: { id }, relations: ['artists'] });
  }

  findByOrganizer(organizerId: string): Promise<Concert[]> {
    return this.repo.find({ where: { organizerId }, relations: ['artists'] });
  }

  create(data: Partial<Concert>): Promise<Concert> {
    return this.repo.save(this.repo.create(data));
  }

  update(id: string, data: Partial<Concert>): Promise<void> {
    return this.repo.update(id, data).then(() => undefined);
  }
}
