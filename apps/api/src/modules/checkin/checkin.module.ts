import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CheckinLog } from './entities/checkin-log.entity';
import { CheckinDevice } from './entities/checkin-device.entity';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CheckinLog, CheckinDevice]),
    TicketsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwt.accessSecret'),
        signOptions: { expiresIn: '7d' }, // Offline token valid for 7 days
      }),
    }),
  ],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
