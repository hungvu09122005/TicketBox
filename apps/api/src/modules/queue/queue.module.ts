import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'csv-import' },
      { name: 'ai-bio' },
      { name: 'orders-expiry' },
    ),

    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),

    BullBoardModule.forFeature(
      { name: 'notifications', adapter: BullAdapter },
      { name: 'csv-import', adapter: BullAdapter },
      { name: 'ai-bio', adapter: BullAdapter },
      { name: 'orders-expiry', adapter: BullAdapter },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
