import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OBJECT_STORAGE_PORT } from '../ports/object-storage.port';
import { MinioObjectStorageAdapter } from '../../modules/common/adapters/minio.adapter';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OBJECT_STORAGE_PORT,
      useFactory: (configService: ConfigService) => new MinioObjectStorageAdapter(configService),
      inject: [ConfigService],
    },
  ],
  exports: [OBJECT_STORAGE_PORT],
})
export class ObjectStorageModule {}
