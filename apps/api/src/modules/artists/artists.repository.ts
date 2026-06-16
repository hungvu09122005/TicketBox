import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artist } from './entities/artist.entity';

@Injectable()
export class ArtistsRepository {
  constructor(@InjectRepository(Artist) private readonly repo: Repository<Artist>) {}

  findAll() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  create(data: Partial<Artist>) { return this.repo.save(this.repo.create(data)); }
  update(id: string, data: Partial<Artist>) { return this.repo.update(id, data); }
  async remove(id: string) { await this.repo.delete(id); }
}
