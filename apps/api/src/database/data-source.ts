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
    join(projectRoot, 'src', 'migrations', '*.{ts,js}'),
    join(projectRoot, 'src', 'database', 'migrations', '*.{ts,js}'),
  ],
});
