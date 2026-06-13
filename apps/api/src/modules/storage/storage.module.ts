import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { OBJECT_STORAGE_PORT } from '../../common/ports/object-storage.port';

@Global()
@Module({
  providers: [
    StorageService,
    {
      provide: OBJECT_STORAGE_PORT,
      useExisting: StorageService,
    },
  ],
  controllers: [StorageController],
  exports: [StorageService, OBJECT_STORAGE_PORT],
})
export class StorageModule {}
