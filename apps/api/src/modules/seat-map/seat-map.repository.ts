import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatZone } from './entities/seat-zone.entity';

@Injectable()
export class SeatMapRepository {
  constructor(@InjectRepository(SeatZone) private readonly repo: Repository<SeatZone>) {}

  async findByConcertId(concertId: string): Promise<SeatZone[]> {
    return this.repo.find({ where: { concertId } });
  }

  async deleteByConcertId(concertId: string): Promise<void> {
    await this.repo.delete({ concertId });
  }

  async createZones(zones: Partial<SeatZone>[]): Promise<SeatZone[]> {
    const newZones = this.repo.create(zones);
    return this.repo.save(newZones);
  }
}
