import { Module } from '@nestjs/common';
import { DemoBootstrapController } from './demo-bootstrap.controller';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../redis/redis.module';


@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [DemoBootstrapController],
  providers: [DemoBootstrapService],
})
export class DemoBootstrapModule {}
