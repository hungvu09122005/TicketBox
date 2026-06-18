import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull'; 
import { BullBoardModule } from '@bull-board/nestjs'; 
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter'; // Sửa thành BullAdapter

@Global()
@Module({
  imports: [
    // 1. Đăng ký các Queue
    BullModule.registerQueue(
      { name: 'notification' },
      { name: 'csv' },
      { name: 'ai' },
      { name: 'maintenance' },
      { name: 'order-expiry' },
    ),
    
    // 2. Cấu hình Dashboard
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    
    // 3. Đăng ký tất cả các queue vào dashboard (Đã thêm order-expiry)
    BullBoardModule.forFeature(
      { name: 'notification', adapter: BullAdapter },
      { name: 'csv', adapter: BullAdapter },
      { name: 'ai', adapter: BullAdapter },
      { name: 'maintenance', adapter: BullAdapter },
      { name: 'order-expiry', adapter: BullAdapter }, // Thêm queue này
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}