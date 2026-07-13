import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) => {
        return new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        });
      },
      inject: [ConfigService],
    },
    RedisService,
    RateLimitGuard,
  ],
  exports: ['REDIS_CLIENT', RedisService, RateLimitGuard],
})
export class RedisModule {}
