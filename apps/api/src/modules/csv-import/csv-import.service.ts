import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CsvImportRepository } from './csv-import.repository';
import { OBJECT_STORAGE_PORT } from '../../common/ports/object-storage.port';
import { ObjectStoragePort } from '../../common/ports/object-storage.port';

@Injectable()
export class CsvImportService {
  constructor(
    private readonly repo: CsvImportRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @InjectQueue('csv-import') private readonly queue: Queue,
  ) {}
  // TODO Phase 6: createJob(file, concertId, userId) → upload to MinIO → enqueue
  //               getJobStatus(jobId)
}
