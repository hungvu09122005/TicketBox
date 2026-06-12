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
  // TODO Phase 3: findById, findByUser, createWithItems (in transaction), markPaid, markExpired
}
