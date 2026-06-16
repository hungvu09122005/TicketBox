import { Injectable } from '@nestjs/common';
import { ArtistsRepository } from './artists.repository';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';

@Injectable()
export class ArtistsService {
  constructor(private readonly repo: ArtistsRepository) {}

  findAll() { return this.repo.findAll(); }
  findById(id: string) { return this.repo.findById(id); }
  create(dto: CreateArtistDto) { return this.repo.create(dto); }
  update(id: string, dto: UpdateArtistDto) { return this.repo.update(id, dto); }
  remove(id: string) { return this.repo.remove(id); }
}
