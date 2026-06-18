import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ConcertsRepository } from './concerts.repository';
import { SeatZoneRepository } from './seat-zone.repository';
import { Concert, ConcertStatus } from './entities/concert.entity';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../common/ports/object-storage.port';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
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
  ) { }

  private async toPublicDto(concert: Concert): Promise<PublicConcertDto> {
    const bannerUrl = concert.bannerObjectKey
      ? await this.storage.getPresignedUrl(concert.bannerObjectKey, 3600)
      : null;

    const artistAvatarUrl = concert.artist?.avatarObjectKey
      ? await this.storage.getPresignedUrl(concert.artist.avatarObjectKey, 3600)
      : null;

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
        avatarUrl: artistAvatarUrl,
      },
    };
  }

  async findPublished(
    page: number = 1,
    limit: number = 10,
    timeFilter?: 'upcoming' | 'past'
  ): Promise<PublicConcertDto[]> {
    const cacheKey = `concerts:published:list:${page}:${limit}:${timeFilter || 'all'}`;
    const cached = await this.cache.get<PublicConcertDto[]>(cacheKey);
    if (cached) return cached;

    const concerts = await this.concertsRepository.findPublished(page, limit, timeFilter);
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
  async assertPublishedAndSaleOpen(concertId: string): Promise<Concert> {
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
    const cacheAny = this.cache as any;
    const store = cacheAny.store || (cacheAny.stores && cacheAny.stores[0]);
    try {
      if (store && store.client && typeof store.client.keys === 'function') {
        const keys = await store.client.keys('concerts:published:list:*');
        if (keys && keys.length > 0) {
          await store.client.del(...keys);
        }
      } else if (store && typeof store.keys === 'function') {
        const keys = await store.keys('concerts:published:list:*');
        for (const key of keys) {
          await this.cache.del(key);
        }
      } else {
        await this.cache.del('concerts:published:list'); // Fallback
      }
    } catch (error) {
      // Ignore cache clear errors
    }
    
    await this.cache.del(`concerts:detail:${concertId}`);
  }

  async checkOwnership(concertId: string, userId: string, isAdmin: boolean): Promise<Concert> {
    const concert = await this.concertsRepository.findByIdAndOrganizer(concertId, userId, isAdmin);
    if (!concert) {
      throw new NotFoundException(`Concert ${concertId} not found`);
    }
    return concert;
  }

  async findOrganizerConcerts(organizerId: string): Promise<PublicConcertDto[]> {
    const concerts = await this.concertsRepository.findByOrganizer(organizerId);
    return Promise.all(concerts.map(c => this.toPublicDto(c)));
  }

  async create(organizerId: string, dto: CreateConcertDto): Promise<Concert> {
    const concert = await this.concertsRepository.create({
      ...dto,
      organizerId,
      status: ConcertStatus.DRAFT,
    });
    return concert;
  }

  async update(id: string, organizerId: string, isAdmin: boolean, dto: UpdateConcertDto): Promise<Concert> {
    await this.checkOwnership(id, organizerId, isAdmin);
    await this.concertsRepository.update(id, dto);
    await this.invalidateCacheFor(id);
    return this.concertsRepository.findById(id) as Promise<Concert>;
  }

  async publish(id: string, organizerId: string, isAdmin: boolean): Promise<Concert> {
    const concert = await this.checkOwnership(id, organizerId, isAdmin);
    
    if (!concert.venue || !concert.description || !concert.bannerObjectKey || !concert.saleStartsAt || !concert.saleEndsAt) {
      throw new BadRequestException('Cannot publish concert: Missing mandatory fields (venue, description, bannerObjectKey, saleStartsAt, saleEndsAt)');
    }

    await this.concertsRepository.update(id, { status: ConcertStatus.PUBLISHED });
    await this.invalidateCacheFor(id);
    return this.concertsRepository.findById(id) as Promise<Concert>;
  }

  async cancel(id: string, organizerId: string, isAdmin: boolean): Promise<Concert> {
    await this.checkOwnership(id, organizerId, isAdmin);
    await this.concertsRepository.update(id, { status: ConcertStatus.CANCELLED });
    await this.invalidateCacheFor(id);
    return this.concertsRepository.findById(id) as Promise<Concert>;
  }

  async uploadSeatMap(zoneId: string, file: Express.Multer.File): Promise<{ success: boolean }> {
    // Placeholder for seat map upload logic
    return { success: true };
  }
}
