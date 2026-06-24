import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BootstrapService } from './bootstrap.service';
import { UsersModule } from '../modules/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {

    console.log('====================');
    console.log('DB HOST:', config.get('app.database.host'));
    console.log('DB PORT:', config.get('app.database.port'));
    console.log('DB USER:', config.get('app.database.username'));
    console.log('DB NAME:', config.get('app.database.name'));
    console.log('====================');

    return {
      type: 'postgres',
      host: config.get<string>('app.database.host'),
      port: config.get<number>('app.database.port'),
      username: config.get<string>('app.database.username'),
      password: config.get<string>('app.database.password'),
      database: config.get<string>('app.database.name'),

      extra: {
        min: config.get<number>('app.database.poolMin'),
        max: config.get<number>('app.database.poolMax'),
      },

      synchronize: false,
      logging: config.get<string>('app.nodeEnv') === 'development',
      autoLoadEntities: true,
      migrationsTableName: 'typeorm_migrations',
    };
  },
}),
  ],

  providers: [BootstrapService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}