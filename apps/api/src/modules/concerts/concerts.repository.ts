import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan } from 'typeorm';
import { Concert, ConcertStatus } from './entities/concert.entity';

@Injectable()
export class ConcertsRepository {
  constructor(
    @InjectRepository(Concert)
    private readonly repo: Repository<Concert>,
  ) {}

  findPublished(
    page: number = 1,
    limit: number = 10,
    timeFilter?: 'upcoming' | 'past'
  ): Promise<Concert[]> {
    const whereCondition: any = { status: ConcertStatus.PUBLISHED };
    
    if (timeFilter === 'upcoming') {
      whereCondition.startsAt = MoreThanOrEqual(new Date());
    } else if (timeFilter === 'past') {
      whereCondition.startsAt = LessThan(new Date());
    }

    return this.repo.find({
      where: whereCondition,
      relations: ['artists'],
      order: { startsAt: timeFilter === 'past' ? 'DESC' : 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  findById(id: string): Promise<Concert | null> {
    return this.repo.findOne({ where: { id }, relations: ['artists'] });
  }

  findByIdAndOrganizer(id: string, organizerId: string, isAdmin: boolean): Promise<Concert | null> {
    const whereCondition = isAdmin ? { id } : { id, organizerId };
    return this.repo.findOne({ where: whereCondition, relations: ['artists'] });
  }

  findByOrganizer(organizerId: string): Promise<Concert[]> {
    return this.repo.find({
      where: { organizerId },
      relations: ['artists'],
      order: { startsAt: 'ASC' },
    });
  }

  findAllConcerts(): Promise<Concert[]> {
    return this.repo.find({
      relations: ['artists'],
      order: { startsAt: 'ASC' },
    });
  }

  create(data: Partial<Concert>): Promise<Concert> {
    return this.repo.save(this.repo.create(data));
  }

  update(id: string, data: Partial<Concert>): Promise<void> {
    return this.repo.update(id, data).then(() => undefined);
  }

  save(concert: Concert): Promise<Concert> {
    return this.repo.save(concert);
  }
}
