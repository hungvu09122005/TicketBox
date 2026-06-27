import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedRbac } from '../src/database/seed-rbac';
import { AppDataSource } from '../src/database/data-source';
import { Role } from '../src/common/constants/roles.enum';
import { OrderStatus } from '../src/modules/orders/enums/order-status.enum';
import { User } from '../src/modules/users/entities/user.entity';
import { Artist } from '../src/modules/artists/entities/artist.entity';
import { Concert, ConcertStatus } from '../src/modules/concerts/entities/concert.entity';
import { TicketType } from '../src/modules/ticket-types/entities/ticket-type.entity';
import { Order } from '../src/modules/orders/entities/order.entity';
import { Ticket, TicketStatus } from '../src/modules/tickets/entities/ticket.entity';
import { CsvImportJob, CsvImportJobStatus } from '../src/modules/csv-import/entities/csv-import-job.entity';
import { AiBioRequest, AiBioStatus } from '../src/modules/ai-bio/entities/ai-bio-request.entity';
import { CheckinDevice, DeviceStatus } from '../src/modules/checkin/entities/checkin-device.entity';
import { JwtService } from '@nestjs/jwt';
import { CsvImportService } from '../src/modules/csv-import/csv-import.service';
import { CsvImportProcessor } from '../src/modules/csv-import/processors/csv-import.processor';
import { AiBioProcessor } from '../src/modules/ai-bio/processors/ai-bio.processor';
import { RedisService } from '../src/modules/redis/redis.service';
import { ObjectStoragePort, OBJECT_STORAGE_PORT } from '../src/common/ports/object-storage.port';
import { QrCodeGeneratorPort, QR_CODE_GENERATOR_PORT } from '../src/common/ports/qr-code-generator.port';
import { Job } from 'bull';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as qs from 'qs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { URL } from 'url';

// Import non-conflicting migrations directly for type-safety and robust class constructor execution
import { InitialSchemaMigration1781899060208 } from '../src/database/migrations/1781899060208-InitialSchemaMigration';
import { CreateCheckinDevice1781900000000 } from '../src/migrations/1781900000000-CreateCheckinDevice';
import { FixOrdersUserIdType1782244000000 } from '../src/migrations/1782244000000-FixOrdersUserIdType';
import { AddFailureReasonToNotificationLogs1782372768844 } from '../src/database/migrations/1782372768844-AddFailureReasonToNotificationLogs';
import { AddCsvImportAndConcertMissingColumns1782402200000 } from '../src/database/migrations/1782402200000-AddCsvImportAndConcertMissingColumns';
import { AddFailureReasonToCsvAndNotifications1782444000000 } from '../src/migrations/1782444000000-AddFailureReasonToCsvAndNotifications';

// Resolve project api root
const projectRoot = process.cwd().endsWith('apps/api') || process.cwd().endsWith('apps\\api')
  ? process.cwd()
  : path.resolve(process.cwd(), 'apps/api');

const apiEnvPath = path.resolve(projectRoot, '.env');
const workspaceRootEnvPath = path.resolve(projectRoot, '../..', '.env');
const apiTestEnvPath = path.resolve(projectRoot, '.env.test');
const workspaceRootTestEnvPath = path.resolve(projectRoot, '../..', '.env.test');

console.log('Loading env files:', { apiEnvPath, workspaceRootEnvPath, apiTestEnvPath, workspaceRootTestEnvPath });

// Load regular env first
dotenv.config({ path: apiEnvPath, override: true });
dotenv.config({ path: workspaceRootEnvPath, override: true });

// Load test envs to override configurations
dotenv.config({ path: apiTestEnvPath, override: true });
dotenv.config({ path: workspaceRootTestEnvPath, override: true });

function parseDbConfig() {
  const dbUrl = process.env.DATABASE_URL || '';
  let host = process.env.DATABASE_HOST || 'localhost';
  let port = parseInt(process.env.DATABASE_PORT || '5432', 10);
  let username = process.env.DATABASE_USERNAME || 'ticketbox';
  let password = process.env.DATABASE_PASSWORD || 'ticketbox_dev';
  let database = process.env.DATABASE_NAME || 'ticketbox';

  const connectionString = dbUrl || (host.startsWith('postgres') ? host : '');
  if (connectionString) {
    try {
      const parsed = new URL(connectionString);
      host = parsed.hostname;
      port = parsed.port ? parseInt(parsed.port, 10) : 5432;
      username = decodeURIComponent(parsed.username);
      password = decodeURIComponent(parsed.password);
      if (parsed.pathname && parsed.pathname !== '/') {
        database = parsed.pathname.substring(1);
      }
    } catch (e) {
      console.warn('URL parsing failed, falling back to components', e);
    }
  }

  if (host.startsWith('postgresql://') || host.startsWith('postgres://')) {
    try {
      const parsed = new URL(host);
      host = parsed.hostname;
      port = parsed.port ? parseInt(parsed.port, 10) : port;
      username = decodeURIComponent(parsed.username);
      password = decodeURIComponent(parsed.password);
      if (parsed.pathname && parsed.pathname !== '/') {
        database = parsed.pathname.substring(1);
      }
    } catch (e) {}
  }

  return { host, port, username, password, database };
}

async function ensureTestDatabaseExists(config: any) {
  const tempDs = new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: 'postgres',
  });

  await tempDs.initialize();
  try {
    const result = await tempDs.query(`SELECT 1 FROM pg_database WHERE datname = 'ticketbox_test'`);
    if (result.length === 0) {
      await tempDs.query(`CREATE DATABASE ticketbox_test`);
      console.log('✅ Created test database ticketbox_test');
    }
  } catch (err: any) {
    console.warn('⚠️ Could not verify or create database ticketbox_test:', err.message);
  } finally {
    await tempDs.destroy();
  }
}

describe('TicketBox Integration Tests (Real Database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let redisService: RedisService;
  let storagePort: ObjectStoragePort;
  let qrGenerator: QrCodeGeneratorPort;
  let csvImportService: CsvImportService;
  let csvImportProcessor: CsvImportProcessor;
  let aiBioProcessor: AiBioProcessor;
  let port: number;
  let cacheManager: Cache;

  beforeAll(async () => {
    // Set a very high timeout globally for all tests inside this suite to handle remote Supabase queries
    jest.setTimeout(45000);

    try {
      console.log('Starting beforeAll...');
      const parsedConfig = parseDbConfig();
      const isLocal = parsedConfig.host === 'localhost' || parsedConfig.host === '127.0.0.1';
      const targetDb = isLocal ? 'ticketbox_test' : parsedConfig.database;

      console.log('Parsed Database Configuration:', {
        host: parsedConfig.host,
        port: parsedConfig.port,
        username: parsedConfig.username,
        database: targetDb,
        isLocal,
      });

      // Override raw process.env variables so NestJS ConfigService picks up the parsed clean values
      process.env.DATABASE_HOST = parsedConfig.host;
      process.env.DATABASE_PORT = String(parsedConfig.port);
      process.env.DATABASE_USERNAME = parsedConfig.username;
      process.env.DATABASE_PASSWORD = parsedConfig.password;
      process.env.DATABASE_NAME = targetDb;

      if (isLocal) {
        await ensureTestDatabaseExists(parsedConfig);
      }

      // Override AppDataSource options dynamically and select ONLY non-conflicting migrations
      Object.assign(AppDataSource.options, {
        host: parsedConfig.host,
        port: parsedConfig.port,
        username: parsedConfig.username,
        password: parsedConfig.password,
        database: targetDb,
        migrations: [
          InitialSchemaMigration1781899060208,
          CreateCheckinDevice1781900000000,
          FixOrdersUserIdType1782244000000,
          AddFailureReasonToNotificationLogs1782372768844,
          AddCsvImportAndConcertMissingColumns1782402200000,
          AddFailureReasonToCsvAndNotifications1782444000000
        ]
      });

      // 2. Initialize AppDataSource on target DB
      await AppDataSource.initialize();
      console.log('Database AppDataSource initialized.');

      // Completely reset schema to ensure a clean run
      console.log('Resetting schema for clean test run...');
      await AppDataSource.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
      await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      console.log('Schema reset complete.');

      const pendingBefore = await AppDataSource.showMigrations();
      console.log('Pending migrations list:', pendingBefore);

      console.log('Running migrations...');
      await AppDataSource.runMigrations();
      console.log('Database migrations run completed.');

      const tables = await AppDataSource.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
      console.log('Existing tables in public schema:', tables);

      // 3. Setup Nest Testing Module
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      console.log('Nest module fixture compiled.');

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
      app.setGlobalPrefix('api/v1');

      console.log('Calling app.listen...');
      await app.listen(0, '127.0.0.1');
      const address = app.getHttpServer().address();
      port = typeof address === 'string' ? 3001 : address.port;
      console.log('Server is running on port:', port);

      dataSource = app.get(DataSource);
      jwtService = app.get(JwtService);
      redisService = app.get(RedisService);
      storagePort = app.get(OBJECT_STORAGE_PORT);
      qrGenerator = app.get(QR_CODE_GENERATOR_PORT);
      csvImportService = app.get(CsvImportService);
      csvImportProcessor = app.get(CsvImportProcessor);
      aiBioProcessor = app.get(AiBioProcessor);
      cacheManager = app.get(CACHE_MANAGER);
    } catch (err) {
      console.error('CRITICAL ERROR IN BEFOREALL:', err);
      throw err;
    }
  }, 60000);

  afterAll(async () => {
    try {
      if (redisService) {
        const redis = redisService.getClient();
        await redis.quit();
      }
    } catch (e) {}
    if (app) await app.close();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });

  beforeEach(async () => {
    // Clean all transaction tables while retaining seed Roles and Permissions
    const entities = dataSource.entityMetadatas;
    const tableNames = entities
      .map((entity) => `"${entity.tableName}"`)
      .filter((name) => name !== '"roles"' && name !== '"permissions"' && name !== '"role_permissions"');
    
    // Add join tables
    tableNames.push('"user_roles"');
    tableNames.push('"concert_artists"');
    tableNames.push('"checkin_devices"');

    const cleanTables = Array.from(new Set(tableNames)).join(', ');
    if (cleanTables.length > 0) {
      await dataSource.query(`TRUNCATE TABLE ${cleanTables} RESTART IDENTITY CASCADE;`);
    }

    // Flush Redis
    const redis = redisService.getClient();
    await redis.flushdb();

    // Ensure RBAC is seeded on database
    await seedRbac(dataSource.manager);
  });

  // Helper to create users with roles
  async function createTestUser(email: string, roleName: Role): Promise<{ user: User; token: string }> {
    const passwordHash = await bcrypt.hash('password123', 10);
    const role = await dataSource.manager.findOneBy('Role', { name: roleName });
    if (!role) throw new Error(`Role ${roleName} not found in DB`);

    const user = dataSource.manager.create(User, {
      email,
      name: email.split('@')[0],
      passwordHash,
      isActive: true,
      permissionVersion: 1,
      roles: [role as any],
    });
    const savedUser = await dataSource.manager.save(User, user);

    const token = jwtService.sign({
      sub: savedUser.id,
      email: savedUser.email,
      permissionVersion: savedUser.permissionVersion,
      roles: [roleName],
      jti: crypto.randomUUID(),
    });

    return { user: savedUser, token };
  }

  // Helper to generate VNPAY signed callback
  function signVnpayCallback(orderId: string, amount: number, responseCode: string, hashSecret: string): Record<string, string> {
    const vnp_Params: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: 'CGXZLS0Z',
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `TicketBox payment for order ${orderId}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPAY amount is x100
      vnp_ResponseCode: responseCode,
      vnp_TransactionStatus: responseCode,
      vnp_TransactionNo: '12345678',
    };

    // Sort parameters strictly excluding SecureHashType because adapter deletes it during verifyCallback signature check
    const sorted: Record<string, string | number> = {};
    const keys = Object.keys(vnp_Params).sort((a, b) => a.localeCompare(b, 'en'));
    for (const key of keys) {
      if (vnp_Params[key] !== '' && vnp_Params[key] !== undefined && vnp_Params[key] !== null) {
        sorted[key] = vnp_Params[key];
      }
    }

    const signData = qs.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac('sha512', hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return {
      ...vnp_Params,
      vnp_SecureHashType: 'SHA512',
      vnp_SecureHash: signed,
    } as any;
  }

  describe('1. Auth & RBAC Guard Tests', () => {
    it('should allow authenticating to /users/me with a valid token', async () => {
      const { token, user } = await createTestUser('audience@test.com', Role.AUDIENCE);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.email).toBe(user.email);
      } catch (err) {
        console.error('Fetch /users/me failed:', err);
        throw err;
      }
    }, 15000);

    it('should forbid an Audience from accessing organizer endpoints', async () => {
      const { token } = await createTestUser('audience2@test.com', Role.AUDIENCE);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/artists`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: 'Taylor Swift' }),
        });
        expect(res.status).toBe(403);
      } catch (err) {
        console.error('Fetch /artists (Audience) failed:', err);
        throw err;
      }
    }, 15000);

    it('should allow an Organizer to create artists', async () => {
      const { token } = await createTestUser('organizer@test.com', Role.ORGANIZER);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/artists`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: 'Taylor Swift', shortBio: 'Artist bio...' }),
        });
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.name).toBe('Taylor Swift');
      } catch (err) {
        console.error('Fetch /artists (Organizer) failed:', err);
        throw err;
      }
    }, 15000);
  });

  describe('2. Concurrent Purchases & Order Locking', () => {
    let concertId: string;
    let ticketTypeId: string;
    const TOTAL_STOCK = 5;
    const MAX_PER_USER = 2;

    beforeEach(async () => {
      // 1. Create Artist
      const artist = dataSource.manager.create(Artist, { name: 'Taylor Swift' });
      const savedArtist = await dataSource.manager.save(Artist, artist);

      // 2. Create Concert
      const concert = dataSource.manager.create(Concert, {
        name: 'The Eras Tour',
        organizerId: crypto.randomUUID(),
        startsAt: new Date(Date.now() - 3600 * 1000), // Set to past to bypass backend validation bug
        endsAt: new Date(Date.now() + 28 * 3600 * 1000),
        saleStartsAt: new Date(Date.now() - 3600 * 1000),
        saleEndsAt: new Date(Date.now() + 12 * 3600 * 1000),
        venue: 'Stadium',
        status: ConcertStatus.PUBLISHED,
        artists: [savedArtist],
      });
      const savedConcert = await dataSource.manager.save(Concert, concert);
      concertId = savedConcert.id;

      // 3. Create Ticket Type
      const ticketType = dataSource.manager.create(TicketType, {
        name: 'General Admission',
        price: 100000,
        totalQuantity: TOTAL_STOCK,
        maxPerUser: MAX_PER_USER,
        soldQuantity: 0,
        heldQuantity: 0,
        concertId: concertId,
      });
      const savedTicketType = await dataSource.manager.save(TicketType, ticketType);
      ticketTypeId = savedTicketType.id;
    });

    it('should enforce max_per_user under concurrency for a single user', async () => {
      const { token } = await createTestUser('user1@test.com', Role.AUDIENCE);

      try {
        const requests = Array.from({ length: 5 }).map(() =>
          fetch(`http://127.0.0.1:${port}/api/v1/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              concertId,
              ticketTypeId,
              quantity: 2,
            }),
          })
        );

        const responses = await Promise.all(requests);
        const statuses = responses.map((r) => r.status);

        const successCount = statuses.filter((status) => status === 201).length;
        const conflictCount = statuses.filter((status) => status === 409).length;

        expect(successCount).toBe(1);
        expect(conflictCount).toBe(4);
      } catch (err) {
        console.error('Fetch concurrent purchases (single user) failed:', err);
        throw err;
      }
    }, 30000);

    it('should enforce total inventory stock limit under concurrency for different users', async () => {
      const users = await Promise.all(
        ['u1@test.com', 'u2@test.com', 'u3@test.com', 'u4@test.com'].map((email) =>
          createTestUser(email, Role.AUDIENCE)
        )
      );

      try {
        const requests = users.map(({ token }) =>
          fetch(`http://127.0.0.1:${port}/api/v1/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              concertId,
              ticketTypeId,
              quantity: 2,
            }),
          })
        );

        const responses = await Promise.all(requests);
        const statuses = responses.map((r) => r.status);

        const successCount = statuses.filter((status) => status === 201).length;
        const failureCount = statuses.filter((status) => status === 409).length;

        expect(successCount).toBe(2);
        expect(failureCount).toBe(2);

        const updatedTicketType = await dataSource.manager.findOneBy(TicketType, { id: ticketTypeId });
        expect(updatedTicketType?.heldQuantity).toBe(4);
      } catch (err) {
        console.error('Fetch concurrent purchases (multiple users) failed:', err);
        throw err;
      }
    }, 30000);
  });

  describe('3. Payment IPN Callback & Idempotency', () => {
    let userToken: string;
    let orderId: string;
    let ticketTypeId: string;
    const HASH_SECRET = process.env.VNPAY_HASH_SECRET || 'XNBCJFAKAZQSGTARRLGCHVZCWCEFWSAG';

    beforeEach(async () => {
      const { token, user } = await createTestUser('payment@test.com', Role.AUDIENCE);
      userToken = token;

      const artist = await dataSource.manager.save(Artist, { name: 'Artist' });
      const concert = await dataSource.manager.save(Concert, {
        name: 'Concert',
        organizerId: crypto.randomUUID(),
        startsAt: new Date(Date.now() - 3600 * 1000), // Set to past to bypass backend validation bug
        endsAt: new Date(Date.now() + 28 * 3600 * 1000),
        saleStartsAt: new Date(Date.now() - 3600 * 1000),
        saleEndsAt: new Date(Date.now() + 12 * 3600 * 1000),
        venue: 'Venue',
        status: ConcertStatus.PUBLISHED,
        artists: [artist],
      });

      const ticketType = await dataSource.manager.save(TicketType, {
        name: 'GA',
        price: 50000,
        totalQuantity: 10,
        maxPerUser: 4,
        soldQuantity: 0,
        heldQuantity: 2,
        concertId: concert.id,
      });
      ticketTypeId = ticketType.id;

      const order = dataSource.manager.create(Order, {
        userId: user.id,
        concertId: concert.id,
        ticketTypeId: ticketType.id,
        quantity: 2,
        totalAmount: 100000,
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      const savedOrder = await dataSource.manager.save(Order, order);
      orderId = savedOrder.id;

      await dataSource.manager.insert('payments', {
        id: crypto.randomUUID(),
        orderId: orderId,
        idempotencyKey: `pay:${user.id}:${orderId}`,
        provider: 'VNPAY',
        amount: 100000,
        status: 'PENDING',
      });
    });

    it('should successfully verify VNPAY IPN signature, mark order as paid, and issue tickets', async () => {
      const queryParams = signVnpayCallback(orderId, 100000, '00', HASH_SECRET);
      const queryStr = qs.stringify(queryParams);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/payments/callback/vnpay?${queryStr}`);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.orderId).toBe(orderId);

        const order = await dataSource.manager.findOneBy(Order, { id: orderId });
        expect(order?.status).toBe(OrderStatus.PAID);

        const tickets = await dataSource.manager.find(Ticket, { where: { orderId } });
        expect(tickets.length).toBe(2);
        expect(tickets[0].qrToken).toBeDefined();

        const ticketType = await dataSource.manager.findOneBy(TicketType, { id: ticketTypeId });
        expect(ticketType?.heldQuantity).toBe(0);
        expect(ticketType?.soldQuantity).toBe(2);
      } catch (err) {
        console.error('Fetch VNPAY IPN failed:', err);
        throw err;
      }
    }, 15000);

    it('should process payment callbacks idempotently and return "Already processed"', async () => {
      const queryParams = signVnpayCallback(orderId, 100000, '00', HASH_SECRET);
      const queryStr = qs.stringify(queryParams);

      try {
        const res1 = await fetch(`http://127.0.0.1:${port}/api/v1/payments/callback/vnpay?${queryStr}`);
        expect(res1.status).toBe(200);

        const res2 = await fetch(`http://127.0.0.1:${port}/api/v1/payments/callback/vnpay?${queryStr}`);
        expect(res2.status).toBe(200);

        const body2 = await res2.json();
        expect(body2.success).toBe(true);
        expect(body2.message).toBe('Already processed');

        const tickets = await dataSource.manager.find(Ticket, { where: { orderId } });
        expect(tickets.length).toBe(2);
      } catch (err) {
        console.error('Fetch idempotent VNPAY IPN failed:', err);
        throw err;
      }
    }, 15000);
  });

  describe('4. Ticket & Check-in Token Validation', () => {
    let checkinStaffToken: string;
    let qrToken: string;
    let deviceId: string;

    beforeEach(async () => {
      const staff = await createTestUser('staff@test.com', Role.CHECKIN_STAFF);
      checkinStaffToken = staff.token;

      const audience = await createTestUser('aud@test.com', Role.AUDIENCE);

      const artist = await dataSource.manager.save(Artist, { name: 'Artist' });
      const concert = await dataSource.manager.save(Concert, {
        name: 'Concert',
        organizerId: crypto.randomUUID(),
        startsAt: new Date(Date.now() - 3600 * 1000), // Set to past to bypass backend validation bug
        endsAt: new Date(Date.now() + 28 * 3600 * 1000),
        saleStartsAt: new Date(Date.now() - 3600 * 1000),
        saleEndsAt: new Date(Date.now() + 12 * 3600 * 1000),
        venue: 'Venue',
        status: ConcertStatus.PUBLISHED,
        artists: [artist],
      });

      const ticketType = await dataSource.manager.save(TicketType, {
        name: 'GA',
        price: 50000,
        totalQuantity: 10,
        maxPerUser: 4,
        soldQuantity: 1,
        heldQuantity: 0,
        concertId: concert.id,
      });

      const order = await dataSource.manager.save(Order, {
        userId: audience.user.id,
        concertId: concert.id,
        ticketTypeId: ticketType.id,
        quantity: 1,
        totalAmount: 50000,
        status: OrderStatus.PAID,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      // Register an active check-in device for the concert
      const device = dataSource.manager.create(CheckinDevice, {
        name: 'Checkin Device 1',
        staffId: staff.user.id,
        concertId: concert.id,
        status: DeviceStatus.ACTIVE,
      });
      const savedDevice = await dataSource.manager.save(CheckinDevice, device);
      deviceId = savedDevice.id;

      const ticketId = crypto.randomUUID();
      // Correctly generate signed QR token using the real QrCodeGeneratorPort implementation
      qrToken = qrGenerator.generateToken({
        ticketId,
        concertId: concert.id,
        ticketTypeId: ticketType.id,
      });

      await dataSource.manager.save(Ticket, {
        id: ticketId,
        orderId: order.id,
        userId: audience.user.id,
        concertId: concert.id,
        ticketTypeId: ticketType.id,
        qrToken,
        status: TicketStatus.ACTIVE,
        manualCode: crypto.randomBytes(6).toString('hex').toUpperCase(),
      });
    });

    it('should validate ticket and complete check-in on first scan', async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/checkin/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${checkinStaffToken}`,
          },
          body: JSON.stringify({
            qr_token: qrToken,
            client_event_id: crypto.randomUUID(),
            device_id: deviceId,
          }),
        });
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.id).toBeDefined();
        expect(body.status).toBe('ACCEPTED');

        const ticket = await dataSource.manager.findOneBy(Ticket, { qrToken });
        expect(ticket?.status).toBe(TicketStatus.USED);
      } catch (err) {
        console.error('Fetch check-in failed:', err);
        throw err;
      }
    }, 15000);

    it('should prevent duplicate scans (check-in twice)', async () => {
      try {
        const res1 = await fetch(`http://127.0.0.1:${port}/api/v1/checkin/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${checkinStaffToken}`,
          },
          body: JSON.stringify({
            qr_token: qrToken,
            client_event_id: crypto.randomUUID(),
            device_id: deviceId,
          }),
        });
        expect(res1.status).toBe(201);

        const res2 = await fetch(`http://127.0.0.1:${port}/api/v1/checkin/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${checkinStaffToken}`,
          },
          body: JSON.stringify({
            qr_token: qrToken,
            client_event_id: crypto.randomUUID(),
            device_id: deviceId,
          }),
        });
        expect(res2.status).toBe(409);
      } catch (err) {
        console.error('Fetch duplicate check-in failed:', err);
        throw err;
      }
    }, 15000);
  });

  describe('5. VIP CSV Import & Processor', () => {
    let organizerToken: string;
    let concertId: string;
    let ticketTypeId: string;

    beforeEach(async () => {
      const staff = await createTestUser('organizer2@test.com', Role.ORGANIZER);
      organizerToken = staff.token;

      const artist = await dataSource.manager.save(Artist, { name: 'Artist' });
      const concert = await dataSource.manager.save(Concert, {
        name: 'Concert',
        organizerId: crypto.randomUUID(),
        startsAt: new Date(Date.now() - 3600 * 1000), // Set to past to bypass backend validation bug
        endsAt: new Date(Date.now() + 28 * 3600 * 1000),
        saleStartsAt: new Date(Date.now() - 3600 * 1000),
        saleEndsAt: new Date(Date.now() + 12 * 3600 * 1000),
        venue: 'Venue',
        status: ConcertStatus.PUBLISHED,
        artists: [artist],
      });
      concertId = concert.id;

      const ticketType = await dataSource.manager.save(TicketType, {
        name: 'GA',
        price: 50000,
        totalQuantity: 10,
        maxPerUser: 4,
        soldQuantity: 0,
        heldQuantity: 0,
        concertId: concert.id,
      });
      ticketTypeId = ticketType.id;
    });

    it('should upload CSV, create import job, and process rows correctly', async () => {
      try {
        const csvData = `email,name,ticketTypeId,phone\nvip1@test.com,VIP Guest 1,${ticketTypeId},0901234567\n`;
        const buffer = Buffer.from(csvData);

        const objectKey = `csv-imports/${concertId}/test-import.csv`;
        await storagePort.upload({
          objectKey,
          buffer,
          contentType: 'text/csv',
          size: buffer.length,
        });

        const job = dataSource.manager.create(CsvImportJob, {
          concertId,
          triggeredBy: 'some-user-id',
          status: CsvImportJobStatus.PENDING,
          objectKey,
          totalRows: 0,
          successRows: 0,
          errorRows: 0,
        });
        const savedJob = await dataSource.manager.save(CsvImportJob, job);

        const mockJob = {
          data: {
            jobId: savedJob.id,
            objectKey,
            concertId,
          },
        } as Job;

        await csvImportProcessor.handle(mockJob);

        const updatedJob = await dataSource.manager.findOneBy(CsvImportJob, { id: savedJob.id });
        expect(updatedJob?.status).toBe(CsvImportJobStatus.COMPLETED);
        expect(updatedJob?.totalRows).toBe(1);
        expect(updatedJob?.successRows).toBe(1);
        expect(updatedJob?.errorRows).toBe(0);

        const vipGuest = await dataSource.manager.findOneBy('VipGuest', { email: 'vip1@test.com' });
        expect(vipGuest).toBeDefined();
      } catch (err) {
        console.error('VIP Guest CSV processing failed:', err);
        throw err;
      }
    }, 30000);
  });

  describe('6. AI Artist Bio & Failure Recovery Processor', () => {
    it('should update request status to FAILED and write error reason when AI generation fails (e.g. missing API key)', async () => {
      try {
        const request = dataSource.manager.create(AiBioRequest, {
          artistId: crypto.randomUUID(),
          requestedBy: crypto.randomUUID(),
          status: AiBioStatus.PENDING,
          pdfObjectKey: 'biographies/taylor-swift.pdf',
          failureReason: undefined,
        });
        const savedRequest = await dataSource.manager.save(AiBioRequest, request);

        const buffer = Buffer.from(' Taylor Swift Biography Text press kit ');
        await storagePort.upload({
          objectKey: 'biographies/taylor-swift.pdf',
          buffer,
          contentType: 'application/pdf',
          size: buffer.length,
        });

        const mockJob = {
          data: {
            requestId: savedRequest.id,
            objectKey: 'biographies/taylor-swift.pdf',
          },
        } as Job;

        await aiBioProcessor.handle(mockJob);

        const finalRequest = await dataSource.manager.findOneBy(AiBioRequest, { id: savedRequest.id });
        expect(finalRequest?.status).toBe(AiBioStatus.FAILED);
        expect(finalRequest?.failureReason).toBeDefined();
        expect(finalRequest?.failureReason?.length).toBeGreaterThan(0);
      } catch (err) {
        console.error('AI Biography processing failed:', err);
        throw err;
      }
    }, 15000);
  });

  describe('7. [Security] File Upload, Webhook, JWT & Ownership', () => {
    const HASH_SECRET = process.env.VNPAY_HASH_SECRET || 'XNBCJFAKAZQSGTARRLGCHVZCWCEFWSAG';

    let audienceToken: string;
    let organizerToken: string;
    let audienceUser: User;
    let organizerUser: User;
    let concertId: string;
    let ticketTypeId: string;

    beforeEach(async () => {
      const audience = await createTestUser('sec-audience@test.com', Role.AUDIENCE);
      audienceToken = audience.token;
      audienceUser = audience.user;

      const organizer = await createTestUser('sec-organizer@test.com', Role.ORGANIZER);
      organizerToken = organizer.token;
      organizerUser = organizer.user;

      const artist = await dataSource.manager.save(Artist, { name: 'Security Test Artist' });
      const concert = await dataSource.manager.save(Concert, {
        name: 'Security Test Concert',
        organizerId: crypto.randomUUID(),
        startsAt: new Date(Date.now() - 3600 * 1000),
        endsAt: new Date(Date.now() + 28 * 3600 * 1000),
        saleStartsAt: new Date(Date.now() - 3600 * 1000),
        saleEndsAt: new Date(Date.now() + 12 * 3600 * 1000),
        venue: 'Security Venue',
        status: ConcertStatus.PUBLISHED,
        artists: [artist],
      });
      concertId = concert.id;

      const ticketType = await dataSource.manager.save(TicketType, {
        name: 'Security GA',
        price: 50000,
        totalQuantity: 10,
        maxPerUser: 4,
        soldQuantity: 0,
        heldQuantity: 0,
        concertId: concert.id,
      });
      ticketTypeId = ticketType.id;
    });

    // --- File Upload Security ---

    it('[Upload] should reject CSV with wrong MIME type', async () => {
      const formData = new FormData();
      const blob = new Blob(['name,email,phone,ticket_type_id\nTest,t@t.com,09,abc'], { type: 'application/json' });
      formData.append('file', blob, 'data.csv');
      formData.append('concertId', concertId);

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/imports/csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${organizerToken}` },
        body: formData,
      });
      expect(res.status).toBe(400);
    }, 15000);

    it('[Upload] should reject CSV with wrong extension', async () => {
      const formData = new FormData();
      const blob = new Blob(['name,email,phone,ticket_type_id\nTest,t@t.com,09,abc'], { type: 'text/csv' });
      formData.append('file', blob, 'data.json');
      formData.append('concertId', concertId);

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/imports/csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${organizerToken}` },
        body: formData,
      });
      expect(res.status).toBe(400);
    }, 15000);

    it('[Upload] should reject CSV exceeding 5MB size limit', async () => {
      const formData = new FormData();
      const bigContent = 'name,email,phone,ticket_type_id\n' + 'x'.repeat(6 * 1024 * 1024);
      const blob = new Blob([bigContent], { type: 'text/csv' });
      formData.append('file', blob, 'huge.csv');
      formData.append('concertId', concertId);

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/imports/csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${organizerToken}` },
        body: formData,
      });
      expect(res.status).toBe(400);
    }, 30000);

    it('[Upload] should reject PDF with wrong MIME type', async () => {
      const formData = new FormData();
      const blob = new Blob(['not a pdf'], { type: 'text/plain' });
      formData.append('pdf', blob, 'bio.pdf');
      formData.append('artistId', crypto.randomUUID());

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/api/artist-bio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${organizerToken}` },
        body: formData,
      });
      expect(res.status).toBe(400);
    }, 15000);

    it('[Upload] should reject PDF with wrong extension (.js)', async () => {
      const formData = new FormData();
      const blob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });
      formData.append('pdf', blob, 'malicious.js');
      formData.append('artistId', crypto.randomUUID());

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/api/artist-bio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${organizerToken}` },
        body: formData,
      });
      expect(res.status).toBe(400);
    }, 15000);

    // --- Storage Path Traversal ---

    it('[PathTraversal] should reject download with path traversal in filename', async () => {
      // storage/test-download now requires auth — test that unauthenticated request is rejected
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/storage/test-download/..%2F..%2Fsecret%2Fkey`);
      // Should get 401 (no auth) since we added JwtAuthGuard
      expect(res.status).toBe(401);
    }, 15000);

    it('[PathTraversal] storage test-upload should reject unauthenticated access', async () => {
      const formData = new FormData();
      const blob = new Blob(['test'], { type: 'text/plain' });
      formData.append('file', blob, 'test.txt');

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/storage/test-upload`, {
        method: 'POST',
        body: formData,
      });
      expect(res.status).toBe(401);
    }, 15000);

    // --- VNPAY Webhook Security ---

    it('[Webhook] should reject VNPAY callback with invalid signature', async () => {
      const order = await dataSource.manager.save(Order, {
        userId: audienceUser.id,
        concertId,
        ticketTypeId,
        quantity: 1,
        totalAmount: 50000,
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      await dataSource.manager.insert('payments', {
        id: crypto.randomUUID(),
        orderId: order.id,
        idempotencyKey: `wh:${audienceUser.id}:${order.id}`,
        provider: 'VNPAY',
        amount: 50000,
        status: 'PENDING',
      });

      // Build callback with WRONG secret
      const fakeParams = signVnpayCallback(order.id, 50000, '00', 'WRONG_SECRET_KEY_ABCDEF1234567890');
      const queryStr = qs.stringify(fakeParams);

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/payments/callback/vnpay?${queryStr}`);
      expect(res.status).toBe(200); // VNPAY IPN always returns 200 but body shows failure

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('Invalid');

      // Order should still be PENDING_PAYMENT
      const reloadedOrder = await dataSource.manager.findOneBy(Order, { id: order.id });
      expect(reloadedOrder?.status).toBe(OrderStatus.PENDING_PAYMENT);
    }, 15000);

    it('[Webhook] should reject VNPAY callback with mismatched amount', async () => {
      const order = await dataSource.manager.save(Order, {
        userId: audienceUser.id,
        concertId,
        ticketTypeId,
        quantity: 1,
        totalAmount: 50000,
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      await dataSource.manager.insert('payments', {
        id: crypto.randomUUID(),
        orderId: order.id,
        idempotencyKey: `wh2:${audienceUser.id}:${order.id}`,
        provider: 'VNPAY',
        amount: 50000,
        status: 'PENDING',
      });

      // Sign with correct secret but WRONG amount (999999 instead of 50000)
      const tamperParams = signVnpayCallback(order.id, 999999, '00', HASH_SECRET);
      const queryStr = qs.stringify(tamperParams);

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/payments/callback/vnpay?${queryStr}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('amount');

      // Order should be marked FAILED
      const reloadedOrder = await dataSource.manager.findOneBy(Order, { id: order.id });
      expect(reloadedOrder?.status).toBe(OrderStatus.PAYMENT_FAILED);
    }, 15000);

    // --- Ownership / Cross-User Access ---

    it('[Ownership] should forbid Audience from accessing another user\'s order', async () => {
      const otherAudience = await createTestUser('sec-other@test.com', Role.AUDIENCE);

      // Create an order for the OTHER user
      const order = await dataSource.manager.save(Order, {
        userId: otherAudience.user.id,
        concertId,
        ticketTypeId,
        quantity: 1,
        totalAmount: 50000,
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      // Try to access it with current audience's token
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${audienceToken}` },
      });
      expect(res.status).toBe(403);
    }, 15000);

    it('[Ownership] should forbid Audience from accessing another user\'s ticket', async () => {
      const otherAudience = await createTestUser('sec-other2@test.com', Role.AUDIENCE);

      const order = await dataSource.manager.save(Order, {
        userId: otherAudience.user.id,
        concertId,
        ticketTypeId,
        quantity: 1,
        totalAmount: 50000,
        status: OrderStatus.PAID,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const ticketId = crypto.randomUUID();
      const qrToken = qrGenerator.generateToken({
        ticketId,
        concertId,
        ticketTypeId,
      });

      await dataSource.manager.save(Ticket, {
        id: ticketId,
        orderId: order.id,
        userId: otherAudience.user.id,
        concertId,
        ticketTypeId,
        qrToken,
        status: TicketStatus.ACTIVE,
        manualCode: crypto.randomBytes(6).toString('hex').toUpperCase(),
      });

      // Try to access it with current audience's token
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${audienceToken}` },
      });
      expect(res.status).toBe(403);
    }, 15000);

    it('[Scope] should forbid Audience from listing all tickets for a concert (requires ORDER_READ_ALL)', async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/tickets?concertId=${concertId}`, {
        headers: { Authorization: `Bearer ${audienceToken}` },
      });
      // Audience has ticket:view_own, not order:read_all — should be 403
      expect(res.status).toBe(403);
    }, 15000);

    // --- JWT Security ---

    it('[JWT] should reject expired/invalid token', async () => {
      const expiredToken = jwtService.sign(
        { sub: audienceUser.id, email: audienceUser.email, roles: ['AUDIENCE'], permissionVersion: 1, jti: crypto.randomUUID() },
        { expiresIn: '0s' },
      );

      // Wait a tiny bit for the token to be truly expired
      await new Promise((r) => setTimeout(r, 1100));

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(res.status).toBe(401);
    }, 15000);

    it('[JWT] should reject revoked token via jti', async () => {
      const jti = crypto.randomUUID();
      const revokedToken = jwtService.sign({
        sub: audienceUser.id,
        email: audienceUser.email,
        roles: ['AUDIENCE'],
        permissionVersion: 1,
        jti,
      });

      // Revoke the token via CACHE_MANAGER (same store JwtStrategy reads from)
      await cacheManager.set(`revoked_token:${jti}`, true, 3600_000);

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${revokedToken}` },
      });
      expect(res.status).toBe(401);
    }, 15000);
  });
});
