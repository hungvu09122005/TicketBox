import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';
import { seedRbac } from './seed-rbac';
import { Ticket, TicketStatus } from '../modules/tickets/entities/ticket.entity';
import { User } from '../modules/users/entities/user.entity';
import { Concert, ConcertStatus } from '../modules/concerts/entities/concert.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { Artist } from '../modules/artists/entities/artist.entity';
import { TicketType } from '../modules/ticket-types/entities/ticket-type.entity';
import { OrderStatus } from '../modules/orders/enums/order-status.enum';
import { Role as RoleEntity } from '../modules/users/entities/role.entity';
import { Role } from '../common/constants/roles.enum';

async function seed() {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    console.log('🚀 Đang chạy full seed...');

    await seedRbac(queryRunner.manager);

    const userRepo = queryRunner.manager.getRepository(User);
    const roleRepo = queryRunner.manager.getRepository(RoleEntity);
    const artistRepo = queryRunner.manager.getRepository(Artist);
    const concertRepo = queryRunner.manager.getRepository(Concert);
    const ticketTypeRepo = queryRunner.manager.getRepository(TicketType);
    const orderRepo = queryRunner.manager.getRepository(Order);
    const ticketRepo = queryRunner.manager.getRepository(Ticket);

    const adminRole = await roleRepo.findOne({ where: { name: Role.SYSTEM_ADMIN } });
    const organizerRole = await roleRepo.findOne({ where: { name: Role.ORGANIZER } });
    const staffRole = await roleRepo.findOne({ where: { name: Role.CHECKIN_STAFF } });
    const audienceRole = await roleRepo.findOne({ where: { name: Role.AUDIENCE } });

    if (!adminRole || !organizerRole || !staffRole || !audienceRole) {
      throw new Error('Roles are missing. Run RBAC seed first.');
    }

    const hashedAdminPassword = await bcrypt.hash('Admin@123456', 12);
    const hashedOrgPassword = await bcrypt.hash('Organizer@123456', 12);
    const hashedStaffPassword = await bcrypt.hash('Staff@123456', 12);
    const hashedAudiencePassword = await bcrypt.hash('Audience@123456', 12);

    const userData = [
      { email: 'admin@ticketbox.local', name: 'System Admin', passwordHash: hashedAdminPassword, roles: [adminRole], isActive: true },
      { email: 'organizer@ticketbox.local', name: 'Organizer User', passwordHash: hashedOrgPassword, roles: [organizerRole], isActive: true },
      { email: 'staff@ticketbox.local', name: 'Check-in Staff', passwordHash: hashedStaffPassword, roles: [staffRole], isActive: true },
      { email: 'audience@ticketbox.local', name: 'Audience User', passwordHash: hashedAudiencePassword, roles: [audienceRole], isActive: true },
    ];

    const users: User[] = [];
    for (const u of userData) {
      let user = await userRepo.findOne({ where: { email: u.email }, relations: { roles: true } });
      if (!user) {
        user = await userRepo.save(userRepo.create(u));
      } else {
        user.name = u.name;
        user.passwordHash = u.passwordHash;
        user.roles = u.roles;
        user.isActive = u.isActive;
        user = await userRepo.save(user);
      }
      users.push(user);
    }

    let artist = await artistRepo.findOne({ where: { name: 'Taylor Swift' } });
    if (!artist) artist = await artistRepo.save(artistRepo.create({ name: 'Taylor Swift' }));

    const organizerUser = users.find((u) => u.email === 'organizer@ticketbox.local')!;
    const audienceUser = users.find((u) => u.email === 'audience@ticketbox.local')!;

    let concert = await concertRepo.findOne({ where: { name: 'Summer Music Fest 2026' } });
    if (!concert) {
      const newConcert = queryRunner.manager.create(Concert, {
        name: 'Summer Music Fest 2026',
        artists: [artist],
        organizerId: organizerUser.id,
        status: ConcertStatus.DRAFT,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
        venue: 'HCMC Stadium',
      });
      concert = await queryRunner.manager.save(newConcert);
    }

    if (!concert) throw new Error('Concert creation failed');

    let ticketType = await ticketTypeRepo.findOne({ where: { concertId: concert.id } });
    if (!ticketType) {
      ticketType = await ticketTypeRepo.save(ticketTypeRepo.create({
        name: 'VIP',
        price: 1000000,
        totalQuantity: 100,
        maxPerUser: 4,
        concertId: concert.id,
      }));
    }

    const statuses = [TicketStatus.ACTIVE, TicketStatus.USED, TicketStatus.CANCELLED];
    for (let i = 0; i < 6; i++) {
      const order = await orderRepo.save(orderRepo.create({
        userId: audienceUser.id,
        concertId: concert.id,
        ticketTypeId: ticketType.id,
        quantity: 1,
        totalAmount: 1000000,
        status: OrderStatus.PAID,
        expiresAt: new Date(Date.now() + 3600000),
      }));

      const qrToken = `TOKEN_SAMPLE_${i}`;
      const existingTicket = await ticketRepo.findOne({ where: { qrToken } });
      if (!existingTicket) {
        await ticketRepo.save(ticketRepo.create({
          orderId: order.id,
          ticketTypeId: ticketType.id,
          userId: audienceUser.id,
          concertId: concert.id,
          qrToken,
          status: statuses[i % 3],
          manualCode: `MC-SEEDED-0${i}`,
        }));
      }
    }

    await queryRunner.commitTransaction();
    console.log('✅ Hoàn tất seeding toàn bộ hệ thống!');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Seeding failed, rolled back:', err);
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
