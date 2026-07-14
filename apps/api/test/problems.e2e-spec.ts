import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DataSource, EntityManager } from 'typeorm';
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
import { VipGuest } from '../src/modules/csv-import/entities/vip-guest.entity';
import { CheckinDevice, DeviceStatus } from '../src/modules/checkin/entities/checkin-device.entity';
import { CheckinLog, CheckinStatus, CheckinMode } from '../src/modules/checkin/entities/checkin-log.entity';
import { JwtService } from '@nestjs/jwt';
import { CsvImportService } from '../src/modules/csv-import/csv-import.service';
import { CsvImportProcessor } from '../src/modules/csv-import/processors/csv-import.processor';
import { RedisService } from '../src/modules/redis/redis.service';
import { QueueService } from '../src/modules/orders/queue.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { CheckinService } from '../src/modules/checkin/checkin.service';
import { ObjectStoragePort, OBJECT_STORAGE_PORT } from '../src/common/ports/object-storage.port';
import { QrCodeGeneratorPort, QR_CODE_GENERATOR_PORT } from '../src/common/ports/qr-code-generator.port';
import { PAYMENT_PORT, PaymentPort } from '../src/common/ports/payment.port';
import { Job } from 'bull';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as qs from 'qs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { URL } from 'url';
import { workspaceRoot } from '../src/config/load-env';

// Import migrations
import { InitialSchemaMigration1781899060208 } from '../src/database/migrations/1781899060208-InitialSchemaMigration';
import { CreateCheckinDevice1781900000000 } from '../src/migrations/1781900000000-CreateCheckinDevice';
import { FixOrdersUserIdType1782244000000 } from '../src/migrations/1782244000000-FixOrdersUserIdType';
import { AddFailureReasonToNotificationLogs1782372768844 } from '../src/database/migrations/1782372768844-AddFailureReasonToNotificationLogs';
import { AddCsvImportAndConcertMissingColumns1782402200000 } from '../src/database/migrations/1782402200000-AddCsvImportAndConcertMissingColumns';
import { AddFailureReasonToCsvAndNotifications1782444000000 } from '../src/migrations/1782444000000-AddFailureReasonToCsvAndNotifications';

const workspaceRootEnvPath = path.resolve(workspaceRoot, '.env');
const workspaceRootTestEnvPath = path.resolve(workspaceRoot, '.env.test');

dotenv.config({ path: workspaceRootEnvPath, override: true });
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
    } catch (e) {}
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
    }
  } catch (err: any) {
    console.warn('⚠️ Could not verify or create database ticketbox_test:', err.message);
  } finally {
    await tempDs.destroy();
  }
}

describe('TicketBox Problems Verification E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let redisService: RedisService;
  let storagePort: ObjectStoragePort;
  let qrGenerator: QrCodeGeneratorPort;
  let csvImportService: CsvImportService;
  let csvImportProcessor: CsvImportProcessor;
  let queueService: QueueService;
  let paymentsService: PaymentsService;
  let checkinService: CheckinService;
  let port: number;
  let cacheManager: Cache;

  beforeAll(async () => {
    jest.setTimeout(90000);
    console.log('--- STARTING beforeAll setup in problems.e2e-spec.ts ---');

    try {
      const parsedConfig = parseDbConfig();
      const isLocal = parsedConfig.host === 'localhost' || parsedConfig.host === '127.0.0.1';
      const targetDb = isLocal ? 'ticketbox_test' : parsedConfig.database;

      console.log('Database Config parsed:', {
        host: parsedConfig.host,
        port: parsedConfig.port,
        username: parsedConfig.username,
        targetDb,
        isLocal
      });

      process.env.DATABASE_HOST = parsedConfig.host;
      process.env.DATABASE_PORT = String(parsedConfig.port);
      process.env.DATABASE_USERNAME = parsedConfig.username;
      process.env.DATABASE_PASSWORD = parsedConfig.password;
      process.env.DATABASE_NAME = targetDb;

      if (isLocal) {
        console.log('Verifying target test database exists...');
        await ensureTestDatabaseExists(parsedConfig);
        console.log('Test database verified.');
      }

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

      console.log('Initializing AppDataSource...');
      await AppDataSource.initialize();
      console.log('AppDataSource initialized.');

      console.log('Resetting schema for clean test run...');
      await AppDataSource.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
      await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      console.log('Schema reset complete.');

      console.log('Running migrations...');
      await AppDataSource.runMigrations();
      console.log('Migrations completed.');

      console.log('Compiling Nest testing module...');
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      console.log('Nest module compiled.');

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
      app.setGlobalPrefix('api/v1');

      console.log('Starting Nest app.listen...');
      await app.listen(0, '127.0.0.1');
      const address = app.getHttpServer().address();
      port = typeof address === 'string' ? 3002 : address.port;
      console.log('Nest app listening on port:', port);

      dataSource = app.get(DataSource);
      jwtService = app.get(JwtService);
      redisService = app.get(RedisService);
      storagePort = app.get(OBJECT_STORAGE_PORT);
      qrGenerator = app.get(QR_CODE_GENERATOR_PORT);
      csvImportService = app.get(CsvImportService);
      csvImportProcessor = app.get(CsvImportProcessor);
      queueService = app.get(QueueService);
      paymentsService = app.get(PaymentsService);
      checkinService = app.get(CheckinService);
      cacheManager = app.get(CACHE_MANAGER);
    } catch (err: any) {
      console.error('❌ CRITICAL ERROR IN beforeAll setup:', err);
      throw err;
    }
  }, 90000);

  afterAll(async () => {
    try {
      if (redisService) {
        const redis = redisService.getClient();
        await redis.quit();
      }
    } catch (e) {}
    if (app) await app.close();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }, 30000);

  beforeEach(async () => {
    const entities = dataSource.entityMetadatas;
    const tableNames = entities
      .map((entity) => `"${entity.tableName}"`)
      .filter((name) => name !== '"roles"' && name !== '"permissions"' && name !== '"role_permissions"');
    
    tableNames.push('"user_roles"');
    tableNames.push('"concert_artists"');
    tableNames.push('"checkin_devices"');
    tableNames.push('"checkin_logs"');

    const cleanTables = Array.from(new Set(tableNames)).join(', ');
    if (cleanTables.length > 0) {
      await dataSource.query(`TRUNCATE TABLE ${cleanTables} RESTART IDENTITY CASCADE;`);
    }

    const redis = redisService.getClient();
    await redis.flushdb();

    await seedRbac(dataSource.manager);
  }, 60000);

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
      vnp_Amount: amount * 100,
      vnp_ResponseCode: responseCode,
      vnp_TransactionStatus: responseCode,
      vnp_TransactionNo: '12345678',
    };

    const sorted: Record<string, string | number> = {};
    const keys = Object.keys(vnp_Params).sort((a, b) => a.localeCompare(b, 'en'));
    for (const key of keys) {
      if (vnp_Params[key] !== '' && vnp_Params[key] !== undefined && vnp_Params[key] !== null) {
        sorted[key] = vnp_Params[key];
      }
    }

    const signData = Object.entries(sorted)
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val)).replace(/%20/g, '+')}`)
      .join('&');
    const hmac = crypto.createHmac('sha512', hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return {
      ...vnp_Params,
      vnp_SecureHashType: 'SHA512',
      vnp_SecureHash: signed,
    } as any;
  }

  async function seedConcertAndTicketType(stock = 5, maxPerUser = 2) {
    const artist = await dataSource.manager.save(Artist, { name: 'Anh Trai Say Hi' });
    const concert = await dataSource.manager.save(Concert, {
      name: 'Concert Anh Trai Say Hi',
      organizerId: crypto.randomUUID(),
      startsAt: new Date(Date.now() - 3600 * 1000),
      endsAt: new Date(Date.now() + 28 * 3600 * 1000),
      saleStartsAt: new Date(Date.now() - 3600 * 1000),
      saleEndsAt: new Date(Date.now() + 12 * 3600 * 1000),
      venue: 'Sân vận động Mỹ Đình',
      status: ConcertStatus.PUBLISHED,
      artists: [artist],
      description: 'Concert lớn nhất Việt Nam năm nay',
      bannerObjectKey: 'banners/anh-trai-say-hi.jpg'
    });

    const ticketType = await dataSource.manager.save(TicketType, {
      name: 'SVIP',
      price: 1500000,
      totalQuantity: stock,
      maxPerUser: maxPerUser,
      soldQuantity: 0,
      heldQuantity: 0,
      concertId: concert.id,
    });

    return { concert, ticketType };
  }

  describe('Scenario 1: Tranh chấp vé (Ticket Contention)', () => {
    it('should prevent overselling by allowing exactly the stock limit of tickets to be held under concurrent purchase requests', async () => {
      const { concert, ticketType } = await seedConcertAndTicketType(5, 2);

      // Create 10 different users
      const users = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
          createTestUser(`con-user-${i}@test.com`, Role.AUDIENCE)
        )
      );

      // Trigger 10 concurrent orders (each buying 1 ticket)
      const requests = users.map(({ token }) =>
        fetch(`http://127.0.0.1:${port}/api/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            concertId: concert.id,
            ticketTypeId: ticketType.id,
            quantity: 1,
          }),
        })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      // Exactly 5 orders must succeed and 5 must fail with 409 Conflict
      expect(successCount).toBe(5);
      expect(conflictCount).toBe(5);

      // Verify DB total held + sold is exactly 5
      const updatedTicketType = await dataSource.manager.findOneBy(TicketType, { id: ticketType.id });
      expect(updatedTicketType?.heldQuantity).toBe(5);
      expect(updatedTicketType?.soldQuantity).toBe(0);
    }, 40000);
  });

  describe('Scenario 2: Tải trọng đột biến (Spike Load Protect & Waiting Room)', () => {
    it('[Rate Limiting] should block requests with HTTP 429 after exceeding limit for the same user', async () => {
      const { concert, ticketType } = await seedConcertAndTicketType(20, 10);
      const { token } = await createTestUser('rl-user@test.com', Role.AUDIENCE);

      // Policy is 5 requests per minute for orders. We fire 8 requests.
      const requests = Array.from({ length: 8 }).map(() =>
        fetch(`http://127.0.0.1:${port}/api/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            concertId: concert.id,
            ticketTypeId: ticketType.id,
            quantity: 1,
          }),
        })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const successOrQueuedCount = statuses.filter((s) => s === 201 || s === 202).length;
      const rateLimitCount = statuses.filter((s) => s === 429).length;

      expect(successOrQueuedCount).toBe(5);
      expect(rateLimitCount).toBe(3);
    }, 30000);

    it('[Waiting Room] should enqueue user into waiting room with HTTP 202 when active checkout sessions are full', async () => {
      const { concert, ticketType } = await seedConcertAndTicketType(10, 4);
      const { token, user } = await createTestUser('wr-user@test.com', Role.AUDIENCE);

      // Seed 100 fake active checkout sessions in Redis to fill capacity (MAX_ACTIVE_TOKENS = 100)
      const activeKey = `waiting_room:${concert.id}:active`;
      const redis = redisService.getClient();
      const pipeline = redis.pipeline();
      for (let i = 0; i < 105; i++) {
        pipeline.zadd(activeKey, Date.now() + 300000, `fake-user-active-${i}`);
      }
      await pipeline.exec();

      // Make checkout request from real user
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          concertId: concert.id,
          ticketTypeId: ticketType.id,
          quantity: 1,
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.status).toBe('QUEUED');
      expect(body.queueToken).toBeDefined();

      // Verify enqueued in Redis
      const queueKey = `waiting_room:${concert.id}:queue`;
      const rank = await redis.zrank(queueKey, user.id);
      expect(rank).not.toBeNull();

      // Simulate background worker promoting queue
      // Clear active room to open slots, then admit
      await redis.del(activeKey);
      await queueService.admitUsersFromQueue(concert.id);

      // Poll status
      const pollRes = await fetch(`http://127.0.0.1:${port}/api/v1/orders/queue/status?concertId=${concert.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(pollRes.status).toBe(200);
      const pollBody = await pollRes.json();
      expect(pollBody.status).toBe('ACTIVE');
    }, 30000);
  });

  describe('Scenario 3: Thanh toán không ổn định & Circuit Breaker', () => {
    const HASH_SECRET = process.env.VNPAY_HASH_SECRET || 'XNBCJFAKAZQSGTARRLGCHVZCWCEFWSAG';

    it('[Callback Failure] should mark order PAYMENT_FAILED and release held inventory when gateway returns failure callback', async () => {
      const { concert, ticketType } = await seedConcertAndTicketType(10, 4);
      const { token, user } = await createTestUser('pay-fail-user@test.com', Role.AUDIENCE);

      // Create order
      const order = await dataSource.manager.save(Order, {
        userId: user.id,
        concertId: concert.id,
        ticketTypeId: ticketType.id,
        quantity: 2,
        totalAmount: 3000000,
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      // Increment held quantity
      await dataSource.manager.increment(TicketType, { id: ticketType.id }, 'heldQuantity', 2);

      await dataSource.manager.insert('payments', {
        id: crypto.randomUUID(),
        orderId: order.id,
        idempotencyKey: `pay-fail-key-${order.id}`,
        provider: 'VNPAY',
        amount: 3000000,
        status: 'PENDING',
      });

      // Sign fail callback ('99' is standard VNPAY failure code)
      const queryParams = signVnpayCallback(order.id, 3000000, '99', HASH_SECRET);
      const queryStr = qs.stringify(queryParams);

      const res = await fetch(`http://127.0.0.1:${port}/api/v1/payments/callback/vnpay?${queryStr}`);
      expect(res.status).toBe(200);

      const orderReloaded = await dataSource.manager.findOneBy(Order, { id: order.id });
      expect(orderReloaded?.status).toBe(OrderStatus.PAYMENT_FAILED);

      const ttReloaded = await dataSource.manager.findOneBy(TicketType, { id: ticketType.id });
      expect(ttReloaded?.heldQuantity).toBe(0);
    }, 20000);

    it('[Circuit Breaker] should fast-fail and return HTTP 503 (Service Unavailable) when payment provider fails consistently', async () => {
      const { concert, ticketType } = await seedConcertAndTicketType(10, 4);
      const { token, user } = await createTestUser('cb-user@test.com', Role.AUDIENCE);

      const paymentPort = app.get<PaymentPort>(PAYMENT_PORT);
      const createUrlSpy = jest.spyOn(paymentPort, 'createPaymentUrl').mockRejectedValue(new Error('Gateway Timeout'));

      try {
        const orderIds: string[] = [];
        for (let i = 0; i < 7; i++) {
          const ord = await dataSource.manager.save(Order, {
            userId: user.id,
            concertId: concert.id,
            ticketTypeId: ticketType.id,
            quantity: 1,
            totalAmount: 1500000,
            status: OrderStatus.PENDING_PAYMENT,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          });
          orderIds.push(ord.id);
        }

        const responses = [];
        const redis = redisService.getClient();
        for (const orderId of orderIds) {
          // Clear payment rate limit for this user to bypass 429
          await redis.del(`ratelimit:payment:${user.id}`);
          const r = await fetch(`http://127.0.0.1:${port}/api/v1/payments/${orderId}/initiate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'idempotency-key': `cb-idemp-${orderId}`,
            },
          });
          responses.push(r);
        }

        const statuses = responses.map((r) => r.status);
        const serviceUnavailableCount = statuses.filter((s) => s === 503).length;

        expect(serviceUnavailableCount).toBeGreaterThan(0);
        
        const lastBody = await responses[responses.length - 1].json();
        expect(lastBody.message).toContain('Payment gateway is currently unavailable');
      } finally {
        createUrlSpy.mockRestore();
      }
    }, 30000);
  });

  describe('Scenario 4: Soát vé offline & Đồng bộ', () => {
    it('should validation scans, reject duplicates, and sync batch idempotently', async () => {
      const { concert, ticketType } = await seedConcertAndTicketType(10, 4);
      const staff = await createTestUser('staff-sync@test.com', Role.CHECKIN_STAFF);

      // Register device
      const regRes = await fetch(`http://127.0.0.1:${port}/api/v1/checkin/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staff.token}`,
        },
        body: JSON.stringify({
          deviceName: 'Gate A Scanner',
          concertId: concert.id,
        }),
      });
      const regBody = await regRes.json();
      const { deviceId, token: deviceToken } = regBody;

      const audience = await createTestUser('aud-sync@test.com', Role.AUDIENCE);

      const order = await dataSource.manager.save(Order, {
        userId: audience.user.id,
        concertId: concert.id,
        ticketTypeId: ticketType.id,
        quantity: 3,
        totalAmount: 4500000,
        status: OrderStatus.PAID,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      // Issue 3 valid tickets
      const tickets = await Promise.all(
        Array.from({ length: 3 }).map(async (_, i) => {
          const ticketId = crypto.randomUUID();
          const qrToken = qrGenerator.generateToken({
            ticketId,
            concertId: concert.id,
            ticketTypeId: ticketType.id,
          });

          return await dataSource.manager.save(Ticket, {
            id: ticketId,
            orderId: order.id,
            userId: audience.user.id,
            concertId: concert.id,
            ticketTypeId: ticketType.id,
            qrToken,
            status: TicketStatus.ACTIVE,
            manualCode: crypto.randomBytes(6).toString('hex').toUpperCase(),
          });
        })
      );

      // Prepare offline sync logs:
      // Log 1: Ticket 0 (Valid offline scan)
      // Log 2: Ticket 1 (Valid offline scan)
      // Log 3: Ticket 1 (Duplicate scan)
      // Log 4: Invalid signature/token
      const logs = [
        {
          qr_token: tickets[0].qrToken,
          client_event_id: 'event-1',
          device_id: deviceId,
          scanned_at: new Date().toISOString(),
        },
        {
          qr_token: tickets[1].qrToken,
          client_event_id: 'event-2',
          device_id: deviceId,
          scanned_at: new Date().toISOString(),
        },
        {
          qr_token: tickets[1].qrToken,
          client_event_id: 'event-3',
          device_id: deviceId,
          scanned_at: new Date().toISOString(),
        },
        {
          qr_token: 'invalid-signature-payload-token-xyz',
          client_event_id: 'event-4',
          device_id: deviceId,
          scanned_at: new Date().toISOString(),
        },
      ];

      // Call Sync batch
      const syncRes = await fetch(`http://127.0.0.1:${port}/api/v1/checkin/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staff.token}`, // Sync endpoint accepts staff.token in JWT
        },
        body: JSON.stringify(logs),
      });

      expect(syncRes.status).toBe(201);
      const syncResults = await syncRes.json();

      expect(syncResults).toEqual([
        { client_event_id: 'event-1', status: 'ACCEPTED' },
        { client_event_id: 'event-2', status: 'ACCEPTED' },
        { client_event_id: 'event-3', status: 'CONFLICT' },
        { client_event_id: 'event-4', status: 'REJECTED', reason: 'Invalid ticket' },
      ]);

      // Check ticket states in DB
      const t0 = await dataSource.manager.findOneBy(Ticket, { id: tickets[0].id });
      const t1 = await dataSource.manager.findOneBy(Ticket, { id: tickets[1].id });
      expect(t0?.status).toBe(TicketStatus.USED);
      expect(t1?.status).toBe(TicketStatus.USED);

      // Call the exact same Sync batch again to check idempotency
      const syncRes2 = await fetch(`http://127.0.0.1:${port}/api/v1/checkin/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staff.token}`,
        },
        body: JSON.stringify(logs),
      });

      expect(syncRes2.status).toBe(201);
      const syncResults2 = await syncRes2.json();

      // All existing client_event_id should return SKIPPED (except event-4 which was not stored due to invalid ticket id, so it is rejected again)
      expect(syncResults2).toEqual([
        { client_event_id: 'event-1', status: 'SKIPPED' },
        { client_event_id: 'event-2', status: 'SKIPPED' },
        { client_event_id: 'event-3', status: 'SKIPPED' },
        { client_event_id: 'event-4', status: 'REJECTED', reason: 'Invalid ticket' },
      ]);
    }, 30000);
  });

  describe('Scenario 5: Tích hợp một chiều - Nhập VIP từ CSV', () => {
    it('should process CSV import, support partial success, log row errors/duplicates, and issue tickets', async () => {
      const { concert, ticketType } = await seedConcertAndTicketType(10, 4);

      const objectKey = `csv-imports/${concert.id}/test-vip-import.csv`;

      // Create import job in DB first
      const job = dataSource.manager.create(CsvImportJob, {
        concertId: concert.id,
        triggeredBy: crypto.randomUUID(),
        status: CsvImportJobStatus.PENDING,
        objectKey,
        totalRows: 0,
        successRows: 0,
        errorRows: 0,
      });
      const savedJob = await dataSource.manager.save(CsvImportJob, job);

      // Pre-seed a duplicate guest in DB associated with the job to test DB-level duplication check
      await dataSource.manager.save(VipGuest, {
        concertId: concert.id,
        ticketTypeId: ticketType.id,
        email: 'preseeded-vip@test.com',
        name: 'Preseeded VIP',
        phone: '0988888888',
        dedupKey: 'preseeded-vip@test.com',
        csvImportJobId: savedJob.id,
      });

      // Prepare CSV data:
      // Row 1: Valid
      // Row 2: Invalid (missing email)
      // Row 3: Duplicate of Row 1 in CSV
      // Row 4: Duplicate of Preseeded VIP in DB
      const csvData =
        `email,name,ticketTypeId,phone\n` +
        `vip-new-1@test.com,VIP Guest New 1,${ticketType.id},0900000001\n` +
        `,VIP Guest Missing Email,${ticketType.id},0900000002\n` +
        `vip-new-1@test.com,VIP Guest Duplicate CSV,${ticketType.id},0900000001\n` +
        `preseeded-vip@test.com,VIP Guest Duplicate DB,${ticketType.id},0988888888\n`;

      const buffer = Buffer.from(csvData);

      // Upload to object storage
      await storagePort.upload({
        objectKey,
        buffer,
        contentType: 'text/csv',
        size: buffer.length,
      });

      const mockJob = {
        data: {
          jobId: savedJob.id,
          objectKey,
          concertId: concert.id,
        },
        attemptsMade: 0,
        opts: { attempts: 1 },
      } as unknown as Job;

      // Handle the job using processor
      await csvImportProcessor.handle(mockJob);

      // Verify job statistics in DB
      const updatedJob = await dataSource.manager.findOneBy(CsvImportJob, { id: savedJob.id });
      expect(updatedJob?.status).toBe(CsvImportJobStatus.PARTIALLY_COMPLETED);
      
      // Valid rows:
      // - vip-new-1@test.com (SUCCESS)
      // - preseeded-vip@test.com (Is updated and ticket issued if missing - SUCCESS)
      // Error/Skipped rows:
      // - missing email (ERROR)
      // - duplicate csv email (ERROR - SKIPPED_DUPLICATE)
      expect(updatedJob?.totalRows).toBe(4);
      expect(updatedJob?.successRows).toBe(2);
      expect(updatedJob?.errorRows).toBe(2);

      // Verify VIP Guest 1 is created and ticket is issued
      const guest = await dataSource.manager.findOneBy(VipGuest, { email: 'vip-new-1@test.com' });
      expect(guest).toBeDefined();
      expect(guest?.ticketId).toBeDefined();

      const ticket = await dataSource.manager.findOneBy(Ticket, { id: guest?.ticketId });
      expect(ticket?.status).toBe(TicketStatus.ACTIVE);
    }, 40000);
  });

  describe('Scenario 6: Giới hạn vé per-user dưới tải đồng thời cao', () => {
    it('should strictly enforce maxPerUser limit when a user fires concurrent purchase requests', async () => {
      const { concert, ticketType } = await seedConcertAndTicketType(20, 2); // Stock 20, MaxPerUser 2
      const { token } = await createTestUser('limit-con@test.com', Role.AUDIENCE);

      // Fire 5 concurrent requests from the same user to buy 2 tickets each (trying to get 10 tickets)
      const requests = Array.from({ length: 5 }).map(() =>
        fetch(`http://127.0.0.1:${port}/api/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            concertId: concert.id,
            ticketTypeId: ticketType.id,
            quantity: 2,
          }),
        })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      // Exactly 1 order must succeed (holding 2 tickets) and 4 must be rejected with 409 Conflict
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);

      // Verify in DB
      const updatedTicketType = await dataSource.manager.findOneBy(TicketType, { id: ticketType.id });
      expect(updatedTicketType?.heldQuantity).toBe(2);
    }, 30000);
  });

  describe('Scenario 7: Homepage & Concert Detail Cache-aside', () => {
    it('should cache published lists, detail pages, availability stats, and invalidate cache on updates', async () => {
      const { concert } = await seedConcertAndTicketType(10, 2);
      const admin = await createTestUser('admin-cache@test.com', Role.SYSTEM_ADMIN);

      // 1. Check published list cache
      const listCacheKey = `concerts:published:list:1:10:all`;
      await cacheManager.del(listCacheKey);

      // First fetch (Cache Miss)
      const listRes1 = await fetch(`http://127.0.0.1:${port}/api/v1/concerts?page=1&limit=10`);
      expect(listRes1.status).toBe(200);

      // Verify cache key exists in Redis via cacheManager
      const listCached = await cacheManager.get(listCacheKey);
      expect(listCached).toBeDefined();
      expect(listCached).not.toBeNull();

      // 2. Check detail page cache
      const detailCacheKey = `concerts:detail:${concert.id}`;
      await cacheManager.del(detailCacheKey);

      // First detail fetch (Cache Miss)
      const detailRes1 = await fetch(`http://127.0.0.1:${port}/api/v1/concerts/${concert.id}`);
      expect(detailRes1.status).toBe(200);

      // Verify key exists via cacheManager
      const detailCached = await cacheManager.get(detailCacheKey);
      expect(detailCached).toBeDefined();
      expect(detailCached).not.toBeNull();

      // 3. Check public availability cache
      const availCacheKey = `concert:${concert.id}:availability`;
      await cacheManager.del(availCacheKey);

      const availRes1 = await fetch(`http://127.0.0.1:${port}/api/v1/concerts/${concert.id}/ticket-types/availability`);
      expect(availRes1.status).toBe(200);

      const availCached = await cacheManager.get(availCacheKey);
      expect(availCached).toBeDefined();
      expect(availCached).not.toBeNull();

      // 4. Invalidation: Update concert title and verify keys are deleted
      const updateRes = await fetch(`http://127.0.0.1:${port}/api/v1/concerts/admin/${concert.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${admin.token}`,
        },
        body: JSON.stringify({
          name: 'Concert Anh Trai Say Hi - Updated Title',
        }),
      });
      expect(updateRes.status).toBe(200);

      // Cache keys should be deleted
      const listCachedAfter = await cacheManager.get(listCacheKey);
      const detailCachedAfter = await cacheManager.get(detailCacheKey);
      expect(listCachedAfter).toBeFalsy();
      expect(detailCachedAfter).toBeFalsy();
    }, 40000);
  });
});
