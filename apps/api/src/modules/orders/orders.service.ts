import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { ConcertsService } from '../concerts/concerts.service';
import { TicketTypesService } from '../ticket-types/ticket-types.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './enums/order-status.enum';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) 
    private readonly orderRepo: Repository<Order>,
    private readonly concertsService: ConcertsService,
    private readonly ticketTypesService: TicketTypesService,
    @InjectQueue('orders-expiry') 
    private readonly ordersQueue: Queue,
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Kiểm tra trạng thái concert
      await this.concertsService.assertPublishedAndSaleOpen(dto.concertId);

      // 2. Lock kho vé (Pessimistic Write)
      const ticketType = await this.ticketTypesService.holdInventory(
        dto.ticketTypeId, 
        dto.quantity, 
        manager
      );

      // 3. Kiểm tra limit người dùng
      const existingOrders = await manager.createQueryBuilder(Order, 'order')
        .select('SUM(order.quantity)', 'total')
        .where('order.userId = :userId', { userId })
        .andWhere('order.ticketTypeId = :ticketTypeId', { ticketTypeId: dto.ticketTypeId })
        .andWhere('order.status IN (:...statuses)', { statuses: [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID] })
        .getRawOne();
      
      const boughtQuantity = parseInt(existingOrders?.total || '0', 10);
      if (boughtQuantity + dto.quantity > ticketType.maxPerUser) {
        throw new ConflictException(`Bạn chỉ được mua tối đa ${ticketType.maxPerUser} vé loại này.`);
      }

      // 4. Khởi tạo và lưu đơn hàng trong transaction
      const order = new Order();
      order.userId = userId;
      order.concertId = dto.concertId;
      order.ticketTypeId = dto.ticketTypeId;
      order.quantity = dto.quantity;
      order.totalAmount = Number(ticketType.price) * dto.quantity;
      order.status = OrderStatus.PENDING_PAYMENT;
      order.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // +10 phút

      const savedOrder = await manager.save(order);

      // 5. Enqueue job hủy đơn tự động sau 10 phút
      await this.ordersQueue.add('expire-order', 
        { orderId: savedOrder.id }, 
        { delay: 10 * 60 * 1000 }
      );

      return savedOrder;
    });
  }

  async findById(id: string) {
    const order = await this.orderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findByUser(userId: string) {
    return await this.orderRepo.findBy({ userId });
  }

  /**
   * Được gọi khi Payment Gateway báo thanh toán thành công
   */
  async markPaid(orderId: string, paymentId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOneBy(Order, { id: orderId });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('Order already processed');
      }

      order.status = OrderStatus.PAID;
      await manager.save(order);

      // Xác nhận chuyển trạng thái vé từ "giữ" sang "bán thành công"
      await this.ticketTypesService.confirmInventory(order.ticketTypeId, order.quantity, manager);
      
      return order;
    });
  }

  /**
   * Xử lý khi đơn hàng quá hạn thanh toán
   */
  async expireOrder(orderId: string) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOneBy(Order, { id: orderId });
      if (order && order.status === OrderStatus.PENDING_PAYMENT) {
        order.status = OrderStatus.EXPIRED;
        await manager.save(order);
        
        // Hoàn lại vé vào kho
        await this.ticketTypesService.releaseInventory(order.ticketTypeId, order.quantity, manager);
      }
    });
  }

  async findOne(id: string): Promise<Order | null> {
    return await this.orderRepo.findOne({ where: { id } });
  }
}
