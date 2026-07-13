import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { BootstrapService } from './bootstrap.service';
//import { UsersModule } from '../modules/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({

   // console.log('====================');
   // console.log('DB HOST:', config.get('app.database.host'));
   // console.log('DB PORT:', config.get('app.database.port'));
   // console.log('DB USER:', config.get('app.database.username'));
   // console.log('DB NAME:', config.get('app.database.name'));
   // console.log('====================');

   // return {
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
      migrationsRun: true,
      migrations: [
        join(process.cwd(), 'src', 'database', 'migrations', '1781899060208-InitialSchemaMigration.{ts,js}'),
        join(process.cwd(), 'src', 'migrations', '1781900000000-CreateCheckinDevice.{ts,js}'),
        join(process.cwd(), 'src', 'migrations', '1782244000000-FixOrdersUserIdType.{ts,js}'),
        join(process.cwd(), 'src', 'migrations', '1782444000000-AddFailureReasonToCsvAndNotifications.{ts,js}'),
        join(process.cwd(), 'src', 'migrations', '1782450000000-AddConcertMetadata.{ts,js}'),
        join(process.cwd(), 'src', 'migrations', '1782460000000-AddManualCodeToTickets.{ts,js}'),
        join(process.cwd(), 'src', 'migrations', '1782470000000-AddTargetTypeToAiBioRequests.{ts,js}'),
        join(process.cwd(), 'src', 'migrations', '1782480000000-DropLegacyArtistIdFromAiBioRequests.{ts,js}'),
      ],
      logging: config.get<string>('app.nodeEnv') === 'development',
      autoLoadEntities: true,
      // Keep the runtime migration history aligned with src/database/seed.ts,
      // which uses TypeORM's default `migrations` table.
      migrationsTableName: 'migrations',
    }),
  }),

  ],

  providers: [BootstrapService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
