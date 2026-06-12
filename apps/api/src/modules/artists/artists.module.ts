import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artist } from './entities/artist.entity';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { ArtistsRepository } from './artists.repository';

/** ArtistsModule — owns Artist entity. Exports ArtistsService for ConcertsModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Artist])],
  controllers: [ArtistsController],
  providers: [ArtistsService, ArtistsRepository],
  exports: [ArtistsService],
})
export class ArtistsModule {}
