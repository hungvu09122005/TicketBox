import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatZone } from './entities/seat-zone.entity';
import { SeatMapController } from './seat-map.controller';
import { SeatMapService } from './seat-map.service';
import { SeatMapRepository } from './seat-map.repository';
import { ConcertsModule } from '../concerts/concerts.module';
import { StorageModule } from '../storage/storage.module';
import { TicketTypesModule } from '../ticket-types/ticket-types.module';

/**
 * SeatMapModule — owns SeatZone entity and SVG metadata.
 *
 * Boundary:
 *   - SVG binary stored in Object Storage via ObjectStoragePort.
 *   - PostgreSQL stores only the object key + zone metadata.
 *   - No other module imports SeatMapRepository.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SeatZone]),
    ConcertsModule,
    StorageModule,
    TicketTypesModule,
  ],
  controllers: [SeatMapController],
  providers: [SeatMapService, SeatMapRepository],
  exports: [SeatMapService],
})
export class SeatMapModule {}
