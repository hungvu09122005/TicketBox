import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { Role as RoleEntity } from '../users/entities/role.entity';
import { Artist } from '../artists/entities/artist.entity';
import { Concert, ConcertStatus } from '../concerts/entities/concert.entity';
import { TicketType } from '../ticket-types/entities/ticket-type.entity';
import { SeatZone } from '../seat-map/entities/seat-zone.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Ticket, TicketStatus } from '../tickets/entities/ticket.entity';
import { NotificationLog, NotificationChannel, NotificationStatus, NotificationType } from '../notifications/entities/notification-log.entity';
import { CheckinLog, CheckinMode, CheckinStatus } from '../checkin/entities/checkin-log.entity';
import { CsvImportJob, CsvImportJobStatus } from '../csv-import/entities/csv-import-job.entity';
import { CsvImportRow, CsvRowStatus } from '../csv-import/entities/csv-import-row.entity';
import { VipGuest } from '../csv-import/entities/vip-guest.entity';
import { AiBioRequest, AiBioStatus } from '../ai-bio/entities/ai-bio-request.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Role } from '../../common/constants/roles.enum';
import { seedRbac } from '../../database/seed-rbac';
import { resetSeedTables } from '../../database/seed-full';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class DemoBootstrapService {
  private readonly logger = new Logger(DemoBootstrapService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async startBootstrap(jobId: string, options: any): Promise<void> {
    const redis = this.redisService.getClient();

    // Run the bootstrap process asynchronously
    Promise.resolve()
      .then(async () => {
        this.logger.log(`Demo bootstrap job ${jobId} started.`);
        await redis.set(`demo-bootstrap:${jobId}`, JSON.stringify({
          status: 'PROCESSING',
          progress: 10,
          message: 'Resetting database tables...',
        }), 'EX', 3600);

        // 1. Reset/Truncate DB
        await resetSeedTables(this.dataSource);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const m = queryRunner.manager;

          // 2. Seed RBAC roles & permissions
          await redis.set(`demo-bootstrap:${jobId}`, JSON.stringify({
            status: 'PROCESSING',
            progress: 30,
            message: 'Seeding roles and permissions...',
          }), 'EX', 3600);
          await seedRbac(m);

          // 3. Seed Users
          await redis.set(`demo-bootstrap:${jobId}`, JSON.stringify({
            status: 'PROCESSING',
            progress: 50,
            message: 'Seeding user accounts...',
          }), 'EX', 3600);

          const defaultPasswordHash = await bcrypt.hash('Demo@123456', 12);
          const adminRole = await m.findOne(RoleEntity, { where: { name: Role.SYSTEM_ADMIN } });
          const organizerRole = await m.findOne(RoleEntity, { where: { name: Role.ORGANIZER } });
          const staffRole = await m.findOne(RoleEntity, { where: { name: Role.CHECKIN_STAFF } });
          const audienceRole = await m.findOne(RoleEntity, { where: { name: Role.AUDIENCE } });

          let adminUser: User | null = null;
          let organizerUser: User | null = null;
          let staffUser: User | null = null;
          let audienceUser: User | null = null;

          if (options.createAdmin && adminRole) {
            adminUser = m.create(User, {
              email: 'admin@ticketbox.local',
              name: 'System Admin',
              passwordHash: defaultPasswordHash,
              isActive: true,
              roles: [adminRole],
            });
            await m.save(User, adminUser);
          }

          if (options.createOrganizer && organizerRole) {
            organizerUser = m.create(User, {
              email: 'organizer@ticketbox.local',
              name: 'Organizer User',
              passwordHash: defaultPasswordHash,
              isActive: true,
              roles: [organizerRole],
            });
            await m.save(User, organizerUser);
          }

          if (options.createStaff && staffRole) {
            staffUser = m.create(User, {
              email: 'staff@ticketbox.local',
              name: 'Check-in Staff',
              passwordHash: defaultPasswordHash,
              isActive: true,
              roles: [staffRole],
            });
            await m.save(User, staffUser);
          }

          if (options.createAudience && audienceRole) {
            audienceUser = m.create(User, {
              email: 'audience@ticketbox.local',
              name: 'Audience User',
              passwordHash: defaultPasswordHash,
              isActive: true,
              roles: [audienceRole],
            });
            await m.save(User, audienceUser);
          }

          // 4. Seed Artists & Concerts
          await redis.set(`demo-bootstrap:${jobId}`, JSON.stringify({
            status: 'PROCESSING',
            progress: 70,
            message: 'Seeding artists and concerts...',
          }), 'EX', 3600);

          let artist: Artist | null = null;
          let concert: Concert | null = null;

          if (options.createArtist) {
            artist = m.create(Artist, {
              name: 'The Neon Waves',
              shortBio: 'Electronic pop band seeded for local development.',
              avatarObjectKey: 'artists/the-neon-waves/avatar.png',
            });
            await m.save(Artist, artist);
          }

          if (options.createConcert && artist && organizerUser) {
            concert = m.create(Concert, {
              name: 'Summer Pulse Live 2026',
              artists: [artist],
              organizerId: organizerUser.id,
              status: ConcertStatus.PUBLISHED,
              startsAt: new Date('2026-08-15T12:00:00.000Z'),
              endsAt: new Date('2026-08-15T15:00:00.000Z'),
              saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
              saleEndsAt: new Date('2026-08-10T23:59:59.000Z'),
              venue: 'Saigon Exhibition and Convention Center',
              description: 'Main seeded concert for audience and organizer workflows.',
              bannerObjectKey: 'concerts/summer-pulse-live-2026/banner.jpg',
            });
            await m.save(Concert, concert);
          }

          // 5. Seed Ticket Types & Seat Zones
          let ticketTypeVip: TicketType | null = null;
          let ticketTypeStandard: TicketType | null = null;

          if (options.createTicketTypes && concert) {
            ticketTypeVip = m.create(TicketType, {
              concertId: concert.id,
              name: 'VIP',
              price: 1800000,
              totalQuantity: 120,
              soldQuantity: 1,
              heldQuantity: 0,
              maxPerUser: 4,
              saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
              saleEndsAt: new Date('2026-08-10T23:59:59.000Z'),
            });
            await m.save(TicketType, ticketTypeVip);

            ticketTypeStandard = m.create(TicketType, {
              concertId: concert.id,
              name: 'Standard',
              price: 750000,
              totalQuantity: 400,
              soldQuantity: 1,
              heldQuantity: 0,
              maxPerUser: 6,
              saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
              saleEndsAt: new Date('2026-08-10T23:59:59.000Z'),
            });
            await m.save(TicketType, ticketTypeStandard);
          }

          if (options.createSeatMap && concert && ticketTypeVip && ticketTypeStandard) {
            const seatZoneA = m.create(SeatZone, {
              concertId: concert.id,
              name: 'Zone A',
              svgObjectKey: 'seat-maps/summer-pulse-live-2026/zone-a.svg',
              ticketTypeId: ticketTypeVip.id,
            });
            await m.save(SeatZone, seatZoneA);

            const seatZoneB = m.create(SeatZone, {
              concertId: concert.id,
              name: 'Zone B',
              svgObjectKey: 'seat-maps/summer-pulse-live-2026/zone-b.svg',
              ticketTypeId: ticketTypeStandard.id,
            });
            await m.save(SeatZone, seatZoneB);
          }

          // 6. Seed CSV Import Job & AI Bio requests
          await redis.set(`demo-bootstrap:${jobId}`, JSON.stringify({
            status: 'PROCESSING',
            progress: 90,
            message: 'Generating demo jobs and metadata...',
          }), 'EX', 3600);

          let csvJob: CsvImportJob | null = null;
          let aiBioRequest: AiBioRequest | null = null;

          if (options.createCsvDemoJob && concert && organizerUser) {
            csvJob = m.create(CsvImportJob, {
              concertId: concert.id,
              triggeredBy: organizerUser.id,
              objectKey: 'imports/vip-guests/summer-pulse.csv',
              status: CsvImportJobStatus.COMPLETED,
              totalRows: 3,
              successRows: 2,
              errorRows: 1,
            });
            await m.save(CsvImportJob, csvJob);

            await m.save(CsvImportRow, m.create(CsvImportRow, {
              jobId: csvJob.id,
              rowNumber: 1,
              status: CsvRowStatus.SUCCESS,
            }));

            await m.save(CsvImportRow, m.create(CsvImportRow, {
              jobId: csvJob.id,
              rowNumber: 2,
              status: CsvRowStatus.SUCCESS,
            }));

            await m.save(CsvImportRow, m.create(CsvImportRow, {
              jobId: csvJob.id,
              rowNumber: 3,
              status: CsvRowStatus.ERROR,
              errorReason: 'Invalid email address',
            }));

            if (ticketTypeVip) {
              await m.save(VipGuest, m.create(VipGuest, {
                concertId: concert.id,
                ticketTypeId: ticketTypeVip.id,
                csvImportJobId: csvJob.id,
                email: 'vip1@ticketbox.local',
                phone: '+84900000001',
                name: 'VIP Guest One',
                dedupKey: 'vip1@ticketbox.local',
              }));

              await m.save(VipGuest, m.create(VipGuest, {
                concertId: concert.id,
                ticketTypeId: ticketTypeVip.id,
                csvImportJobId: csvJob.id,
                email: 'vip2@ticketbox.local',
                phone: '+84900000002',
                name: 'VIP Guest Two',
                dedupKey: 'vip2@ticketbox.local',
              }));
            }
          }

          if (options.createAiBioDemoJob && artist && adminUser) {
            aiBioRequest = m.create(AiBioRequest, {
              artistId: artist.id,
              requestedBy: adminUser.id,
              pdfObjectKey: 'ai-bio/the-neon-waves.pdf',
              status: AiBioStatus.PUBLISHED,
              draftContent: 'Generated biography content for The Neon Waves.',
            });
            await m.save(AiBioRequest, aiBioRequest);
          }

          await queryRunner.commitTransaction();

          const createdSummary = {
            adminUserId: adminUser?.id || null,
            organizerUserId: organizerUser?.id || null,
            staffUserId: staffUser?.id || null,
            audienceUserId: audienceUser?.id || null,
            artistId: artist?.id || null,
            concertId: concert?.id || null,
            ticketTypeIds: [ticketTypeVip?.id, ticketTypeStandard?.id].filter(Boolean) as string[],
            csvJobId: csvJob?.id || null,
            aiBioRequestId: aiBioRequest?.id || null,
          };

          await redis.set(`demo-bootstrap:${jobId}`, JSON.stringify({
            status: 'COMPLETED',
            progress: 100,
            message: 'Seeding completed successfully!',
            created: createdSummary,
          }), 'EX', 3600);

          this.logger.log(`Demo bootstrap job ${jobId} completed successfully.`);

        } catch (dbError: any) {
          await queryRunner.rollbackTransaction();
          throw dbError;
        } finally {
          await queryRunner.release();
        }

      })
      .catch(async (error: any) => {
        this.logger.error(`Demo bootstrap job ${jobId} failed: ${error.message}`);
        await redis.set(`demo-bootstrap:${jobId}`, JSON.stringify({
          status: 'FAILED',
          progress: 100,
          message: error.message || 'Seeding failed due to database error.',
        }), 'EX', 3600);
      });
  }

  async getStatus(jobId: string): Promise<any> {
    const redis = this.redisService.getClient();
    const statusStr = await redis.get(`demo-bootstrap:${jobId}`);
    if (!statusStr) {
      return {
        status: 'FAILED',
        progress: 100,
        message: 'Bootstrap job not found or expired.',
      };
    }
    return JSON.parse(statusStr);
  }
}
