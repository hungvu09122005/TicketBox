import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AiBioRequest } from './entities/ai-bio-request.entity';
import { AiBioController } from './ai-bio.controller';
import { AiBioService } from './ai-bio.service';
import { AiBioRepository } from './ai-bio.repository';
import { AiBioProcessor } from './processors/ai-bio.processor';
import { GrokAdapter } from './adapters/grok.adapter';
import { AI_TEXT_GENERATION_PORT } from '../../common/ports/ai-text-generation.port';
import { StorageModule } from '../storage/storage.module';
import { ArtistsModule } from '../artists/artists.module';
import { ConcertsModule } from '../concerts/concerts.module';

/**
 * AiBioModule — PDF upload → AI generation → draft → publish pipeline.
 *
 * Dependency rules:
 *   - Standalone module. Does NOT import OrdersModule, TicketsModule, etc.
 *   - AITextGenerationPort fulfilled by GrokAdapter (circuit breaker in processor)
 *   - PDF binary in Object Storage; key in ai_bio_requests.pdf_object_key
 *   - Never auto-publishes; Organizer must explicitly PATCH to publish
   */
@Module({
  imports: [
    TypeOrmModule.forFeature([AiBioRequest]),
    BullModule.registerQueue({ name: 'ai-bio' }),
    StorageModule,
    ArtistsModule,
    ConcertsModule,
    ConfigModule,
  ],
  controllers: [AiBioController],
  providers: [
    AiBioService,
    AiBioRepository,
    AiBioProcessor,
    GrokAdapter,
    {
      provide: AI_TEXT_GENERATION_PORT,
      useClass: GrokAdapter,
    },
  ],
  exports: [AiBioService],
})
export class AiBioModule {}
