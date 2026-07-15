import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from './entities/concert.entity';
import { SeatZone } from './entities/seat-zone.entity'; // Import thêm
import { TicketType } from './entities/ticket-type.entity'; // Import thêm
import { ConcertsController } from './concerts.controller';
import { ConcertsService } from './concerts.service';
import { ConcertsRepository } from './concerts.repository';
import { SeatZoneRepository } from './seat-zone.repository'; // Import repository mới
import { ArtistsModule } from '../artists/artists.module';
import { CommonModule } from '../../common/common.module'; // Import CommonModule
import { DatabaseModule } from '../../database/database.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Concert]), // Đăng ký các entities
    ArtistsModule,
    CommonModule,
    DatabaseModule, // Quan trọng: để dùng được OBJECT_STORAGE_PORT
  ],
  controllers: [ConcertsController],
  providers: [
    ConcertsService,
    ConcertsRepository,
    SeatZoneRepository, // Đăng ký repository mới
  ],
  exports: [ConcertsService],
})
export class ConcertsModule {}