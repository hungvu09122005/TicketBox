import { Module } from '@nestjs/common';
import { MinioObjectStorageAdapter } from './adapters/minio.adapter';
import { OBJECT_STORAGE_PORT } from './ports/object-storage.port';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE_PORT,
      useClass: MinioObjectStorageAdapter,
    },
  ],
  exports: [OBJECT_STORAGE_PORT],
})
export class CommonModule {}