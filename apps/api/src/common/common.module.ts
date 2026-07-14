import { Module } from '@nestjs/common';
import { S3ObjectStorageAdapter } from './adapters/s3.adapter';
import { OBJECT_STORAGE_PORT } from './ports/object-storage.port';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE_PORT,
      useClass: S3ObjectStorageAdapter,
    },
  ],
  exports: [OBJECT_STORAGE_PORT],
})
export class CommonModule {}