import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SeatZone } from './entities/seat-zone.entity';
import { InjectDataSource } from '@nestjs/typeorm';


@Injectable()
export class SeatZoneRepository extends Repository<SeatZone> {
  constructor( 
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    super(SeatZone, dataSource.createEntityManager());
  }
}