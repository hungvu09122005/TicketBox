import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SeatZone } from './entities/seat-zone.entity';

@Injectable()
export class SeatZoneRepository extends Repository<SeatZone> {
  constructor(private dataSource: DataSource) {
    super(SeatZone, dataSource.createEntityManager());
  }
}