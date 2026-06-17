import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from './entities/concert.entity';
import { ConcertsController } from './concerts.controller';
import { ConcertsService } from './concerts.service';
import { ConcertsRepository } from './concerts.repository';
import { ArtistsModule } from '../artists/artists.module';
import { CommonModule } from '../../common/common.module'; // Import CommonModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Concert]), // Đăng ký các entities
    ArtistsModule,
    CommonModule, // Quan trọng: để dùng được OBJECT_STORAGE_PORT
  ],
  controllers: [ConcertsController],
  providers: [
    ConcertsService,
    ConcertsRepository,
  ],
  exports: [ConcertsService],
})
export class ConcertsModule {}