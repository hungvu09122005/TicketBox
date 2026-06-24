import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Logger } from 'nestjs-pino';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { ConcertsService } from '../concerts/concerts.service';
import { TicketTypesService } from '../ticket-types/ticket-types.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from './enums/order-status.enum';
import { MailService } from '../../mail/mail.service';
import { User } from '../users/entities/user.entity';

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
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly logger: Logger,
    private readonly mailService: MailService,
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string): Promise<Order> {
    let savedOrder: Order | null = null;
    let savedOrderId: string | null = null;
    let userEmail: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      // 1. Kiểm tra trạng thái concert
      await this.concertsService.assertPublishedAndSaleOpen(dto.concertId);

      // 2. Lock kho vé
      const ticketType = await this.ticketTypesService.holdInventory(dto.ticketTypeId, dto.quantity, manager);

      // 3. Kiểm tra limit người dùng
      const existingOrders = await manager.createQueryBuilder(Order, 'order')
        .select('SUM(order.quantity)', 'total')
        .where('order.userId = :userId', { userId })
        .andWhere('order.ticketTypeId = :ticketTypeId', { ticketTypeId: dto.ticketTypeId })
        .andWhere('order.status IN (:...statuses)', { statuses: [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID] })
        .getRawOne();
      
      const boughtQuantity = parseInt(existingOrders?.total || '0', 10);
      if (boughtQuantity + dto.quantity > ticketType.maxPerUser) {
        throw new ConflictException(`Bạn chỉ được mua tối đa ${ticketType.maxPerUser} vé.`);
      }

      // 4. KHỞI TẠO ĐƠN HÀNG TRƯỚC KHI LƯU
      const order = new Order();
      order.userId = userId;
      order.concertId = dto.concertId;
      order.ticketTypeId = dto.ticketTypeId;
      order.quantity = dto.quantity;
      order.totalAmount = Number(ticketType.price) * dto.quantity;
      order.status = OrderStatus.PENDING_PAYMENT;
      order.expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // LƯU ĐƠN HÀNG
      savedOrder = await manager.save(order);
      savedOrderId = savedOrder.id;

      // Lấy email user trong transaction
      const user = await manager.findOneBy(User, { id: userId });
      userEmail = user?.email ?? null;

      // 5. Enqueue job
      await this.ordersQueue.add('expire-order', { orderId: savedOrder.id }, { delay: 10 * 60 * 1000 });
      await this.cache.del(`concert:${dto.concertId}:availability`);
    });

    // GỬI MAIL SAU TRANSACTION
    if (userEmail && savedOrderId) {
      this.mailService.sendEmail({
      to: userEmail,
      subject: '[TicketBox] Order created',
      html: `
        <h2>TicketBox Order Created</h2>
        <p>Đơn hàng của bạn đã được tạo.</p>
        <p>Order ID: ${savedOrderId}</p>
      `,
  text: `TicketBox Order Created\nOrder ID: ${savedOrderId}`,
}).catch((err: Error) =>
  this.logger.error(`Gửi mail thất bại: ${err.message}`),
);
    }

    return savedOrder!;
  }

async findOne(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ 
      where: { id },
      relations: ['user'] 
    });
    
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findByUser(userId: string): Promise<Order[]> {
    return await this.orderRepo.findBy({ userId });
  }

  async findByUserWithFilters(userId: string, query: OrderQueryDto) {
    const { page = 1, limit = 10, status, concertId } = query;
    const qb = this.orderRepo.createQueryBuilder('order')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('order.status = :status', { status });
    if (concertId) qb.andWhere('order.concertId = :concertId', { concertId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findAllWithFilters(query: OrderQueryDto) {
    const { page = 1, limit = 10, status, concertId } = query;
    const qb = this.orderRepo.createQueryBuilder('order')
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('order.status = :status', { status });
    if (concertId) qb.andWhere('order.concertId = :concertId', { concertId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Được gọi khi Payment Gateway báo thanh toán thành công
   */
  async markPaid(orderId: string, paymentId: string): Promise<Order> {
    let order: Order | null = null; // Khai báo order bên ngoài để dùng sau transaction

    await this.dataSource.transaction(async (manager) => {
      order = await manager.findOne(Order, { 
        where: { id: orderId }, 
        relations: ['user'] // Phải load quan hệ user để lấy email
      }) as Order | null;
      
      if (!order) throw new NotFoundException('Order not found');

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('Order already processed');
      }

      order.status = OrderStatus.PAID;
      await manager.save(order);
      await this.ticketTypesService.confirmInventory(order.ticketTypeId, order.quantity, manager);
      await this.cache.del(`concert:${order.concertId}:availability`);
    });

    // GỬI MAIL SAU KHI TRANSACTION XONG
    if (order && (order as Order).user?.email) {
      const userEmail = (order as Order).user.email;
      this.mailService.sendEmail({
      to: userEmail,
      subject: '[TicketBox] Payment confirmed',
   html: `
      <h2>TicketBox Payment Confirmed</h2>
      <p>Thanh toán của bạn đã được xác nhận.</p>
      <p>Order ID: ${orderId}</p>
    `,
    text: `TicketBox Payment Confirmed\nOrder ID: ${orderId}`,
  }).catch((err: Error) => {
    this.logger.error(`Gửi mail thất bại cho đơn ${orderId}: ${err.message}`);
  });
    }
    
    return order!;
  }

  /**
   * Xử lý khi đơn hàng quá hạn thanh toán
   */
  async expireOrder(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOneBy(Order, { id: orderId });
      if (order && order.status === OrderStatus.PENDING_PAYMENT) {
        order.status = OrderStatus.EXPIRED;
        await manager.save(order);
        await this.ticketTypesService.releaseInventory(order.ticketTypeId, order.quantity, manager);
        await this.cache.del(`concert:${order.concertId}:availability`);
        this.logger.log({ msg: 'Audit: Order expired', orderId: order.id });
      }
    });
  }
  /**
   * Xử lý khi payment thất bại
   */
  async markPaymentFailed(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOneBy(Order, { id: orderId });
      if (order && order.status === OrderStatus.PENDING_PAYMENT) {
        order.status = OrderStatus.PAYMENT_FAILED;
        await manager.save(order);
        await this.ticketTypesService.releaseInventory(order.ticketTypeId, order.quantity, manager);
        await this.cache.del(`concert:${order.concertId}:availability`);
        this.logger.log({ msg: 'Audit: Payment failed', orderId: order.id });
      }
    });
  }
  async findOneWithUserByTextJoin(id: string): Promise<Order & { user: User }> {
  const order = await this.orderRepo
    .createQueryBuilder('order')
    .where('order.id = :id', { id })
    .getOne();

  if (!order) {
    throw new NotFoundException('Order not found');
  }

  const user = await this.dataSource
    .getRepository(User)
    .createQueryBuilder('u')
    .where('CAST(u.id AS text) = :userId', { userId: order.userId })
    .getOne();

  if (!user) {
    throw new NotFoundException(`User not found for order ${id}`);
  }

  return Object.assign(order, { user });
}
}
