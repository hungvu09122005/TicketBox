import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersRepository extends Repository<Order> {
  constructor(private dataSource: DataSource) {
    super(Order, dataSource.createEntityManager());
  }
  
  // Bạn không cần viết đè lại find, findOne, create vì Repository đã có sẵn.
  // Nếu vẫn bị lỗi, hãy dùng thẳng orderRepo bên trong service
}