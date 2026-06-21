import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull'; 
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { OrderExpiryProcessor } from './processors/order-expiry.processor';
import { QueueReleaseProcessor } from './processors/queue-release.processor';
import { ConcertsModule } from '../concerts/concerts.module';
import { TicketTypesModule } from '../ticket-types/ticket-types.module';
import { QueueService } from './queue.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    BullModule.registerQueue({ name: 'orders-expiry' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwt.accessSecret') || 'fallback_secret_queue',
        signOptions: { expiresIn: '2h' },
      }),
    }),
    ConcertsModule,
    TicketTypesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrderExpiryProcessor, QueueService, QueueReleaseProcessor],
  exports: [OrdersService, QueueService],
})
export class OrdersModule {}
