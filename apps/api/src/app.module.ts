import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import * as redisStore from 'cache-manager-ioredis';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './modules/queue/queue.module';
// Domain Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ArtistsModule } from './modules/artists/artists.module';
import { ConcertsModule } from './modules/concerts/concerts.module';
import { SeatMapModule } from './modules/seat-map/seat-map.module';
import { TicketTypesModule } from './modules/ticket-types/ticket-types.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { CsvImportModule } from './modules/csv-import/csv-import.module';
import { AiBioModule } from './modules/ai-bio/ai-bio.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';

// Middlewares
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';

/**
 * AppModule — root module registering all infrastructure and domain modules.
 */
@Module({
  imports: [
    // ── Infrastructure ─────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        customProps: (req, res) => ({
          context: 'HTTP',
        }),
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),

    DatabaseModule,

    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),

    QueueModule,

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        store: redisStore,
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        ttl: 60,
      }),
    }),

    ThrottlerModule.forRoot([
      { name: 'public', ttl: 60_000, limit: 100 },
      { name: 'order', ttl: 60_000, limit: 5 },
      { name: 'checkin', ttl: 60_000, limit: 60 },
    ]),

    // ── Domain Modules ─────────────────────────────────────────────────────
    HealthModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ArtistsModule,
    ConcertsModule,
    SeatMapModule,
    TicketTypesModule,
    OrdersModule,
    PaymentsModule,
    TicketsModule,
    CheckinModule,
    CsvImportModule,
    AiBioModule,
    NotificationsModule,
    ReportingModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}


