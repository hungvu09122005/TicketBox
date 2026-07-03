import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';

const projectRoot = process.cwd().endsWith('apps/api') || process.cwd().endsWith('apps\\api')
  ? process.cwd()
  : resolve(process.cwd(), 'apps/api');

dotenv.config({ path: resolve(projectRoot, '.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: false,
  entities: [join(projectRoot, 'src', '**', '*.entity.{ts,js}')],
  migrations: [
    join(projectRoot, 'src', 'database', 'migrations', '1781899060208-InitialSchemaMigration.{ts,js}'),
    join(projectRoot, 'src', 'migrations', '1781900000000-CreateCheckinDevice.{ts,js}'),
    join(projectRoot, 'src', 'migrations', '1782244000000-FixOrdersUserIdType.{ts,js}'),
    join(projectRoot, 'src', 'migrations', '1782444000000-AddFailureReasonToCsvAndNotifications.{ts,js}'),
    join(projectRoot, 'src', 'migrations', '1782450000000-AddConcertMetadata.{ts,js}'),
    join(projectRoot, 'src', 'migrations', '1782460000000-AddManualCodeToTickets.{ts,js}'),
    join(projectRoot, 'src', 'migrations', '1782470000000-AddTargetTypeToAiBioRequests.{ts,js}'),
    join(projectRoot, 'src', 'migrations', '1782480000000-DropLegacyArtistIdFromAiBioRequests.{ts,js}'),
  ],
});
