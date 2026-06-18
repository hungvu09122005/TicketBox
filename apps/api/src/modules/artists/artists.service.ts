import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ArtistsRepository } from './artists.repository';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { Artist } from './entities/artist.entity';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../common/ports/object-storage.port';

export type ArtistWithAvatarUrl = Artist & {
  avatarUrl: string | null;
};

@Injectable()
export class ArtistsService {
  constructor(
    private readonly repo: ArtistsRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  private async toPublicDto(artist: Artist): Promise<ArtistWithAvatarUrl> {
    const avatarUrl = artist.avatarObjectKey
      ? await this.storage.getPresignedUrl(artist.avatarObjectKey, 3600)
      : null;

    return {
      ...artist,
      avatarUrl,
    };
  }

  async findAll(): Promise<ArtistWithAvatarUrl[]> {
    const artists = await this.repo.findAll();
    return Promise.all(artists.map((artist) => this.toPublicDto(artist)));
  }

  async findById(id: string): Promise<ArtistWithAvatarUrl> {
    const artist = await this.repo.findById(id);
    if (!artist) {
      throw new NotFoundException(`Artist ${id} not found.`);
    }
    return this.toPublicDto(artist);
  }
  create(dto: CreateArtistDto) { return this.repo.create(dto); }
  update(id: string, dto: UpdateArtistDto) { return this.repo.update(id, dto); }
  remove(id: string) { return this.repo.remove(id); }
}
