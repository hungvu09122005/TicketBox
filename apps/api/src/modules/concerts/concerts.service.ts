import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ConcertsRepository } from './concerts.repository';
import { Concert, ConcertStatus } from './entities/concert.entity';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';

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

  async findOrganizerConcerts(organizerId: string): Promise<Concert[]> {
    return this.concertsRepository.findByOrganizer(organizerId);
  }

  async createConcert(organizerId: string, dto: CreateConcertDto): Promise<Concert> {
    const concert = await this.concertsRepository.create({
      ...dto,
      organizerId,
      status: ConcertStatus.DRAFT,
    });
    return concert;
  }

  async updateConcert(
    id: string,
    organizerId: string,
    dto: UpdateConcertDto,
    isAdmin: boolean,
  ): Promise<void> {
    const concert = await this.concertsRepository.findById(id);
    if (!concert) throw new NotFoundException('Concert not found');
    if (!isAdmin && concert.organizerId !== organizerId) {
      throw new ForbiddenException('You do not own this concert');
    }

    await this.concertsRepository.update(id, dto);
    await this.invalidateCacheFor(id);
  }

  async publishConcert(
    id: string,
    organizerId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const concert = await this.concertsRepository.findById(id);
    if (!concert) throw new NotFoundException('Concert not found');
    if (!isAdmin && concert.organizerId !== organizerId) {
      throw new ForbiddenException('You do not own this concert');
    }

    if (
      !concert.startsAt ||
      !concert.endsAt ||
      !concert.saleStartsAt ||
      !concert.saleEndsAt ||
      !concert.venue ||
      !concert.artistId
    ) {
      throw new BadRequestException('Missing mandatory fields to publish a concert');
    }

    await this.concertsRepository.update(id, { status: ConcertStatus.PUBLISHED });
    await this.invalidateCacheFor(id);
  }

  async cancelConcert(
    id: string,
    organizerId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const concert = await this.concertsRepository.findById(id);
    if (!concert) throw new NotFoundException('Concert not found');
    if (!isAdmin && concert.organizerId !== organizerId) {
      throw new ForbiddenException('You do not own this concert');
    }

    if (concert.startsAt && new Date() > concert.startsAt) {
      throw new BadRequestException('Cannot cancel a concert that has already started');
    }

    await this.concertsRepository.update(id, { status: ConcertStatus.CANCELLED });
    await this.invalidateCacheFor(id);
  }
}
