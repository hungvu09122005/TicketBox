import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OBJECT_STORAGE_PORT } from '../ports/object-storage.port';
import { S3ObjectStorageAdapter } from '../../modules/common/adapters/s3.adapter';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OBJECT_STORAGE_PORT,
      useFactory: (configService: ConfigService) => new S3ObjectStorageAdapter(configService),
      inject: [ConfigService],
    },
  ],
  exports: [OBJECT_STORAGE_PORT],
})
export class ObjectStorageModule {}
