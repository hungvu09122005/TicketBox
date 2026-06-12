import { Injectable } from '@nestjs/common';
import { ArtistsRepository } from './artists.repository';

@Injectable()
export class ArtistsService {
  constructor(private readonly repo: ArtistsRepository) {}

  findAll() { return this.repo.findAll(); }
  findById(id: string) { return this.repo.findById(id); }
}
