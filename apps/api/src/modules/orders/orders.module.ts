import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull'; 
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { OrderExpiryProcessor } from './processors/order-expiry.processor';
import { ConcertsModule } from '../concerts/concerts.module';
import { TicketTypesModule } from '../ticket-types/ticket-types.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    BullModule.registerQueue({ name: 'orders-expiry' }),
    ConcertsModule,
    TicketTypesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrderExpiryProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
