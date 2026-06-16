import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ConcertsRepository } from './concerts.repository';
import { Concert as ConcertEntity, ConcertStatus } from './entities/concert.entity';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../common/ports/object-storage.port';
import { PublicConcertDto } from './dto/public-concert.dto';

/**
 * ConcertsService — application service layer.
 *
 * Responsibilities:
 *   - Concert CRUD with organizer ownership check.
 *   - Redis cache-aside for list/detail (Blueprint §07-protection §2).
 *   - Cache invalidation on write.
 *   - Published validation for order creation (exported method).
 */
@Injectable()
export class ConcertsService {
  constructor(
    private readonly concertsRepository: ConcertsRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
  ) {}

  async findPublished(): Promise<PublicConcertDto[]> {
    const cacheKey = 'concerts:published:list';
    const cached = await this.cache.get<PublicConcertDto[]>(cacheKey);
    if (cached) return cached;

    const concerts = await this.concertsRepository.findPublished();
    const ttl = this.config.get<number>('app.cache.concertListTtl', 60) * 1000;
    const payload = await Promise.all(concerts.map((concert) => this.toPublicDto(concert)));
    await this.cache.set(cacheKey, payload, ttl);
    return payload;
  }

  async findById(id: string): Promise<PublicConcertDto> {
    const cacheKey = `concerts:detail:${id}`;
    const cached = await this.cache.get<PublicConcertDto>(cacheKey);
    if (cached) return cached;

    const concert = await this.concertsRepository.findById(id);
    if (!concert) throw new NotFoundException(`Concert ${id} not found.`);

    const ttl = this.config.get<number>('app.cache.concertDetailTtl', 120) * 1000;
    const payload = await this.toPublicDto(concert);
    await this.cache.set(cacheKey, payload, ttl);
    return payload;
  }

  /** Used by OrdersModule — validates concert is published and sale window is open. */
  async assertPublishedAndSaleOpen(concertId: string): Promise<ConcertEntity> {
    const concert = await this.concertsRepository.findById(concertId);
    if (!concert || concert.status !== ConcertStatus.PUBLISHED) {
      throw new NotFoundException('Concert not available for purchase.');
    }
    const now = new Date();
    if (concert.saleStartsAt && now < concert.saleStartsAt) {
      throw new ForbiddenException('Sale has not started yet.');
    }
    if (concert.saleEndsAt && now > concert.saleEndsAt) {
      throw new ForbiddenException('Sale has ended.');
    }
    return concert;
  }

  async invalidateCacheFor(concertId: string): Promise<void> {
    await Promise.all([
      this.cache.del('concerts:published:list'),
      this.cache.del(`concerts:detail:${concertId}`),
    ]);
  }

  // TODO Phase 2: createConcert, updateConcert, cancelConcert with ownership check

  private async toPublicDto(concert: ConcertEntity): Promise<PublicConcertDto> {
    const [bannerUrl, avatarUrl] = await Promise.all([
      concert.bannerObjectKey
        ? this.storage.getPresignedUrl(concert.bannerObjectKey, 60 * 60)
        : Promise.resolve(null),
      concert.artist.avatarObjectKey
        ? this.storage.getPresignedUrl(concert.artist.avatarObjectKey, 60 * 60)
        : Promise.resolve(null),
    ]);

    return {
      id: concert.id,
      name: concert.name,
      description: concert.description ?? null,
      startsAt: concert.startsAt.toISOString(),
      endsAt: concert.endsAt.toISOString(),
      saleStartsAt: concert.saleStartsAt?.toISOString() ?? null,
      saleEndsAt: concert.saleEndsAt?.toISOString() ?? null,
      venue: concert.venue ?? null,
      status: concert.status,
      bannerUrl,
      artist: {
        id: concert.artist.id,
        name: concert.artist.name,
        avatarUrl,
      },
    };
  }
}
