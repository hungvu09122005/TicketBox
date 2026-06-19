import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ConcertsRepository } from './concerts.repository';
import { SeatZoneRepository } from './seat-zone.repository';
import { Concert, ConcertStatus } from './entities/concert.entity';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../common/ports/object-storage.port';

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
    private readonly seatZoneRepository: SeatZoneRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
  ) {}

  // Thêm vào class ConcertsService
  
  /** * Kiểm tra xem user có phải là người sở hữu concert không.
   * Dùng cho các tác vụ: update, cancel, publish
   */
  async assertUserOwnsConcert(userId: string, concertId: string): Promise<Concert> {
    const concert = await this.concertsRepository.findById(concertId);
    
    if (!concert) {
      throw new NotFoundException(`Concert ${concertId} not found.`);
    }

    // Kiểm tra quyền sở hữu (organizerId là trường lưu ID người tạo/sở hữu)
    if (concert.organizerId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this concert.');
    }

    return concert;
  }

  async findPublished(): Promise<Concert[]> {
    const cacheKey = 'concerts:published:list';
    const cached = await this.cache.get<Concert[]>(cacheKey);
    if (cached) return cached;

    const concerts = await this.concertsRepository.findPublished();
    const ttl = this.config.get<number>('app.cache.concertListTtl', 60) * 1000;
    await this.cache.set(cacheKey, concerts, ttl);
    return concerts;
  }

  async findById(id: string): Promise<Concert> {
    const cacheKey = `concerts:detail:${id}`;
    const cached = await this.cache.get<Concert>(cacheKey);
    if (cached) return cached;

    const concert = await this.concertsRepository.findById(id);
    if (!concert) throw new NotFoundException(`Concert ${id} not found.`);

    const ttl = this.config.get<number>('app.cache.concertDetailTtl', 120) * 1000;
    await this.cache.set(cacheKey, concert, ttl);
    return concert;
  }

  /** Used by OrdersModule — validates concert is published and sale window is open. */
  async assertPublishedAndSaleOpen(concertId: string): Promise<Concert> {
    const concert = await this.concertsRepository.findById(concertId);
    if (!concert || concert.status !== ConcertStatus.PUBLISHED) {
      throw new NotFoundException('Concert not available for purchase.');
    }
    const now = new Date();
    if (concert.startsAt && now < concert.startsAt) {
      throw new ForbiddenException('Sale has not started yet.');
    }
    if (concert.endsAt && now > concert.endsAt) {
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

  // Thêm hàm này vào class ConcertsService
  async uploadSeatMap(zoneId: string, file: Express.Multer.File): Promise<string> {
    const objectKey = await this.objectStorage.upload({
      objectKey: `seatmaps/${zoneId}.svg`,
      buffer: file.buffer,
      contentType: file.mimetype,
      size: file.size,
    });

    await this.seatZoneRepository.update(zoneId, { svgPath: objectKey });
    return objectKey;
  }

  // TODO Phase 2: createConcert, updateConcert, cancelConcert with ownership check
}
