import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatZone } from './entities/seat-zone.entity';

@Injectable()
export class SeatMapRepository {
  constructor(@InjectRepository(SeatZone) private readonly repo: Repository<SeatZone>) {}
  // TODO Phase 2: findByConcertId, upsertZone
}
