import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { AiBioRequest } from './entities/ai-bio-request.entity';
import { AiBioController } from './ai-bio.controller';
import { AiBioService } from './ai-bio.service';
import { AiBioRepository } from './ai-bio.repository';
import { AiBioProcessor } from './processors/ai-bio.processor';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { AI_TEXT_GENERATION_PORT } from '../../common/ports/ai-text-generation.port';
import { StorageModule } from '../storage/storage.module';
import { Artist } from '../artists/entities/artist.entity';

/**
 * AiBioModule — PDF upload → AI generation → draft → publish pipeline.
 *
 * Dependency rules:
 *   - Standalone module. Does NOT import OrdersModule, TicketsModule, etc.
 *   - AITextGenerationPort fulfilled by OpenAIAdapter (circuit breaker in processor)
 *   - PDF binary in Object Storage; key in ai_bio_requests.pdf_object_key
 *   - Never auto-publishes; Organizer must explicitly PATCH to publish
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AiBioRequest, Artist]),
    BullModule.registerQueue({ name: 'ai-bio' }),
    StorageModule,
  ],
  controllers: [AiBioController],
  providers: [
    AiBioService,
    AiBioRepository,
    AiBioProcessor,
    { provide: AI_TEXT_GENERATION_PORT, useClass: OpenAIAdapter },
  ],
  exports: [AiBioService],
})
export class AiBioModule {}
