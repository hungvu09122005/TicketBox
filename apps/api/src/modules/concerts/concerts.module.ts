import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from './entities/concert.entity';
import { ConcertsController } from './concerts.controller';
import { ConcertsService } from './concerts.service';
import { ConcertsRepository } from './concerts.repository';
import { ArtistsModule } from '../artists/artists.module';

/**
 * ConcertsModule — owns Concert entity and cache management.
 *
 * Boundary rules:
 *   - Imports ArtistsModule for artist lookup (via ArtistsService, not ArtistsRepository).
 *   - Exports ConcertsService for OrdersModule (concert existence + sale window check).
 *   - Redis cache-aside for concert list/detail handled in ConcertsService.
 *   - Cache invalidation triggered here on PATCH/DELETE.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Concert]),
    ArtistsModule,
  ],
  controllers: [ConcertsController],
  providers: [ConcertsService, ConcertsRepository],
  exports: [ConcertsService],
})
export class ConcertsModule {}
