import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

/** Private to OrdersModule only. */
@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
  ) {}
  findByUser(userId: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  findByIdAndOwner(id: string, userId: string, isAdmin: boolean): Promise<Order | null> {
    const whereCondition = isAdmin ? { id } : { id, userId };
    return this.orderRepo.findOne({
      where: whereCondition,
    });
  }

  // TODO Phase 3: findById, createWithItems (in transaction), markPaid, markExpired
}
