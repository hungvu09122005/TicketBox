import { Injectable, Inject, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
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
  private readonly logger = new Logger(ConcertsService.name);

  constructor(
    private readonly concertsRepository: ConcertsRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
  ) { }

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


  async findPublished(
    page: number = 1,
    limit: number = 10,
    timeFilter?: 'upcoming' | 'past'
  ): Promise<PublicConcertDto[]> {
    const cacheKey = `concerts:published:list:${page}:${limit}:${timeFilter || 'all'}`;
    const cached = await this.cache.get<PublicConcertDto[]>(cacheKey);
    if (cached) {
      this.logger.log(`[Cache Hit] Key: ${cacheKey}`);
      return cached;
    }

    this.logger.log(`[Cache Miss] Key: ${cacheKey}`);
    const concerts = await this.concertsRepository.findPublished(page, limit, timeFilter);
    const ttl = this.config.get<number>('app.cache.concertListTtl', 60) * 1000;
    const payload = await this.mapConcertsToPublicDtos(concerts, 'published');
    await this.cache.set(cacheKey, payload, ttl);
    return payload;
  }

  async findById(id: string): Promise<PublicConcertDto> {
    const cacheKey = `concerts:detail:${id}`;
    if (this.cache) {
      const cached = await this.cache.get<PublicConcertDto>(cacheKey);
      if (cached) {
        this.logger.log(`[Cache Hit] Key: ${cacheKey}`);
        return cached;
      }
    }

    this.logger.log(`[Cache Miss] Key: ${cacheKey}`);
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

  private async toPublicDto(concert: Concert): Promise<PublicConcertDto> {
    const bannerUrl = await this.safeGetPresignedUrl(concert.bannerObjectKey, `concert:${concert.id}:banner`);

    // 1. Tạo mảng artists từ concert.artists
    const artists = await Promise.all(
      (concert.artists || []).map(async (artist) => {
        const avatarUrl = await this.safeGetPresignedUrl(artist.avatarObjectKey, `artist:${artist.id}:avatar`);
        
        return {
          id: artist.id,
          name: artist.name,
          avatarUrl: avatarUrl,
        };
      })
    );

    // 2. Gán mảng artists vào DTO
    return {
      id: concert.id,
      name: concert.name,
      description: concert.description ?? null,
      startsAt: concert.startsAt.toISOString(),
      endsAt: concert.endsAt.toISOString(),
      saleStartsAt: concert.saleStartsAt?.toISOString() ?? null,
      saleEndsAt: concert.saleEndsAt?.toISOString() ?? null,
      venue: concert.venue ?? null,
      status: concert.status as 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED',
      bannerUrl: bannerUrl,
      artists: artists, // Sử dụng biến mảng vừa tạo ở trên
    };
  }

  private async mapConcertsToPublicDtos(concerts: Concert[], scope: string): Promise<PublicConcertDto[]> {
    const results = await Promise.allSettled(
      concerts.map(async (concert) => this.toPublicDto(concert)),
    );

    return results.flatMap((result, index) => {
      if (result.status === 'fulfilled') {
        return [result.value];
      }

      const concert = concerts[index];
      this.logger.error(
        `Failed to map concert ${concert.id} for ${scope} list: ${this.getErrorMessage(result.reason)}`,
        this.getErrorStack(result.reason),
      );
      return [];
    });
  }

  private async safeGetPresignedUrl(objectKey: string | null | undefined, context: string): Promise<string | null> {
    if (!objectKey) {
      return null;
    }

    try {
      return await this.storage.getPresignedUrl(objectKey, 3600);
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for ${context}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      return null;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  private getErrorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }

  async invalidateCacheFor(concertId: string): Promise<void> {
    const redis = this.redisService.getClient();
    try {
      // Keyv prefix-namespaces cache keys with 'keyv:' by default
      const keys = await redis.keys('*concerts:published:list:*');
      if (keys && keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate list cache: ${error.message}`);
    }

    try {
      const detailKeys = await redis.keys(`*concerts:detail:${concertId}*`);
      if (detailKeys && detailKeys.length > 0) {
        await redis.del(...detailKeys);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate detail cache: ${error.message}`);
    }

    try {
      const availKeys = await redis.keys(`*concert:${concertId}:availability*`);
      if (availKeys && availKeys.length > 0) {
        await redis.del(...availKeys);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate availability cache: ${error.message}`);
    }
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
    return this.mapConcertsToPublicDtos(concerts, 'organizer');
  }

  async findAllConcerts(): Promise<PublicConcertDto[]> {
    const concerts = await this.concertsRepository.findAllConcerts();
    return this.mapConcertsToPublicDtos(concerts, 'admin');
  }

  async create(organizerId: string, dto: CreateConcertDto): Promise<Concert> {
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt).getTime() <= new Date(dto.startsAt).getTime()) {
      throw new BadRequestException('Thời gian kết thúc concert phải sau thời gian bắt đầu.');
    }
    if (dto.saleStartsAt && dto.saleEndsAt && new Date(dto.saleEndsAt).getTime() <= new Date(dto.saleStartsAt).getTime()) {
      throw new BadRequestException('Thời gian kết thúc bán vé phải sau thời gian bắt đầu bán vé.');
    }

    const { artistIds, ...concertData } = dto;
    const artists = artistIds.map((id) => ({ id }) as any);
    const concert = await this.concertsRepository.create({
      ...concertData,
      organizerId,
      status: ConcertStatus.DRAFT,
      artists,
    });
    return concert;
  }

  async update(id: string, organizerId: string, isAdmin: boolean, dto: UpdateConcertDto): Promise<Concert> {
    console.log('DEBUG UPDATE CONCERT RECEIVED DTO:', JSON.stringify(dto));
    const concert = await this.checkOwnership(id, organizerId, isAdmin);
    const { artistIds, ...updateData } = dto;

    const currentStartsAt = updateData.startsAt !== undefined ? updateData.startsAt : concert.startsAt;
    const currentEndsAt = updateData.endsAt !== undefined ? updateData.endsAt : concert.endsAt;
    if (currentStartsAt && currentEndsAt && new Date(currentEndsAt).getTime() <= new Date(currentStartsAt).getTime()) {
      throw new BadRequestException('Thời gian kết thúc concert phải sau thời gian bắt đầu.');
    }

    const currentSaleStartsAt = updateData.saleStartsAt !== undefined ? updateData.saleStartsAt : concert.saleStartsAt;
    const currentSaleEndsAt = updateData.saleEndsAt !== undefined ? updateData.saleEndsAt : concert.saleEndsAt;
    if (currentSaleStartsAt && currentSaleEndsAt && new Date(currentSaleEndsAt).getTime() <= new Date(currentSaleStartsAt).getTime()) {
      throw new BadRequestException('Thời gian kết thúc bán vé phải sau thời gian bắt đầu bán vé.');
    }

    const scalarUpdates = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => value !== undefined),
    );
    console.log('DEBUG UPDATE CONCERT SCALAR UPDATES:', JSON.stringify(scalarUpdates));

    Object.assign(concert, scalarUpdates);

    if (artistIds) {
      concert.artists = artistIds.map((aid) => ({ id: aid }) as any);
    }

    await this.concertsRepository.save(concert);

    await this.invalidateCacheFor(id);
    return this.concertsRepository.findById(id) as Promise<Concert>;
  }

  async updateById(id: string, dto: Partial<Concert>): Promise<void> {
    await this.concertsRepository.update(id, dto);
    await this.invalidateCacheFor(id);
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
