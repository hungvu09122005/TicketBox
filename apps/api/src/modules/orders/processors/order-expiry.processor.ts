import { Processor, Process } from '@nestjs/bull'; // Sử dụng @Process
import { Job } from 'bull'; // Sử dụng 'bull'
import { Logger } from '@nestjs/common';
import { OrderStatus } from '../enums/order-status.enum';
import { OrdersService } from '../orders.service';

@Processor('orders-expiry')
export class OrderExpiryProcessor {
  private readonly logger = new Logger(OrderExpiryProcessor.name);

  constructor(private readonly ordersService: OrdersService) {}

  // Dùng @Process thay vì process() của WorkerHost
  @Process('expire-order') // Tên job cụ thể bạn push vào queue
  async handleExpireOrder(job: Job<{ orderId: string }>): Promise<void> {
    const { orderId } = job.data;
    
    // 1. Re-read để đảm bảo tính idempotent
    const order = await this.ordersService.findOne(orderId);
    if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
       this.logger.log(`Đơn hàng ${orderId} đã được thanh toán hoặc không tồn tại, bỏ qua.`);
       return;
    }

    // 2. Gọi service thực hiện transaction
    try {
       await this.ordersService.expireOrder(orderId);
       this.logger.log(`Đơn hàng ${orderId} đã hết hạn thành công.`);
    } catch (error) {
       this.logger.error(`Lỗi khi xử lý hết hạn đơn hàng ${orderId}:`, error);
       throw error; 
    }
  }
}