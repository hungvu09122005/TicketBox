import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AiBioRepository } from './ai-bio.repository';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../common/ports/object-storage.port';

@Injectable()
export class AiBioService {
  constructor(
    private readonly repo: AiBioRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @InjectQueue('ai-bio') private readonly queue: Queue,
  ) {}
  // TODO Phase 7: createRequest(pdfFile, artistId, userId), publishDraft(requestId), editDraft, manualEntry
}
