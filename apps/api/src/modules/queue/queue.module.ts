import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs'; // Thêm dòng này
import { ExpressAdapter } from '@bull-board/express';  // Thêm dòng này
import { BullAdapter } from '@bull-board/api/bullAdapter'; // Thêm dòng này

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'notification' },
      { name: 'csv' },
      { name: 'ai' },
      { name: 'maintenance' },
    ),
    // Cấu hình Dashboard
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    // Đăng ký tất cả các queue vào dashboard
    BullBoardModule.forFeature(
      { name: 'notification', adapter: BullAdapter },
      { name: 'csv', adapter: BullAdapter },
      { name: 'ai', adapter: BullAdapter },
      { name: 'maintenance', adapter: BullAdapter },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}