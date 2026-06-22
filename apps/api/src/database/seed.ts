import { AppDataSource } from './data-source';
import { seedRbac } from './seed-rbac';
import { Ticket, TicketStatus } from '../modules/tickets/entities/ticket.entity';
import { User } from '../modules/users/entities/user.entity';
import { Concert, ConcertStatus } from '../modules/concerts/entities/concert.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { Artist } from '../modules/artists/entities/artist.entity';
import { TicketType } from '../modules/ticket-types/entities/ticket-type.entity';
import { OrderStatus } from '../modules/orders/enums/order-status.enum';
<<<<<<< HEAD

=======
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
>>>>>>> feature/mysunday
async function seed() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const dataSource = appContext.get(DataSource);
  const queryRunner = dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    console.log('🚀 Đang chạy full seed...');

    // 1. RBAC
    await seedRbac(queryRunner.manager);

    const userRepo = queryRunner.manager.getRepository(User);
    const artistRepo = queryRunner.manager.getRepository(Artist);
    const concertRepo = queryRunner.manager.getRepository(Concert);
    const ticketTypeRepo = queryRunner.manager.getRepository(TicketType);
    const orderRepo = queryRunner.manager.getRepository(Order);
    const ticketRepo = queryRunner.manager.getRepository(Ticket);

    // 2. Seed Users (Check tồn tại để tránh trùng email)
    const userData = [
      { email: 'org@ticketbox.com', name: 'Organizer', passwordHash: 'hashed_pwd', isActive: true },
      { email: 'staff@ticketbox.com', name: 'Staff', passwordHash: 'hashed_pwd', isActive: true },
      { email: 'user1@ticketbox.com', name: 'Audience 1', passwordHash: 'hashed_pwd', isActive: true },
    ];

    const users: User[] = [];
    for (const u of userData) {
      let user = await userRepo.findOne({ where: { email: u.email } });
      if (!user) user = await userRepo.save(userRepo.create(u));
      users.push(user);
    }

    // 3. Seed Artist & Concert
    let artist = await artistRepo.findOne({ where: { name: 'Taylor Swift' } });
    if (!artist) artist = await artistRepo.save(artistRepo.create({ name: 'Taylor Swift' }));

    let concert = await concertRepo.findOne({ where: { name: 'Summer Music Fest 2026' } });
    if (!concert) {
      // Dùng queryRunner.manager.create thay vì repo.create để đảm bảo nằm trong transaction
      const newConcert = queryRunner.manager.create(Concert, {
        name: 'Summer Music Fest 2026',
        artists: [artist], // <--- Đã sửa: dùng mảng artists thay vì artistId
        organizerId: users[0].id,
        status: ConcertStatus.DRAFT,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
        venue: 'HCMC Stadium'
      });
      concert = await queryRunner.manager.save(newConcert); // <--- Lưu qua manager
    }

    // Kiểm tra null để tránh lỗi ts(18047)
    if (!concert) throw new Error('Concert creation failed');

    // 4. Seed TicketType
    let ticketType = await ticketTypeRepo.findOne({ where: { concertId: concert.id } });
    if (!ticketType) {
      ticketType = await ticketTypeRepo.save(ticketTypeRepo.create({
        name: 'VIP', price: 1000000, totalQuantity: 100, maxPerUser: 4, concertId: concert.id
      }));
    }

    // 5. Seed Tickets cho Audience (user[2]) - Test Check-in States
    const statuses = [TicketStatus.ACTIVE, TicketStatus.USED, TicketStatus.CANCELLED];
    for (let i = 0; i < 6; i++) {
      const order = await orderRepo.save(orderRepo.create({
        userId: users[2].id, concertId: concert.id, ticketTypeId: ticketType.id,
        quantity: 1, totalAmount: 1000000, status: OrderStatus.PAID, expiresAt: new Date(Date.now() + 3600000)
      }));
      
      const qrToken = `TOKEN_SAMPLE_${i}`;
      const existingTicket = await ticketRepo.findOne({ where: { qrToken } });
      if (!existingTicket) {
        await ticketRepo.save(ticketRepo.create({
          orderId: order.id, ticketTypeId: ticketType.id, userId: users[2].id,
          concertId: concert.id, qrToken, status: statuses[i % 3]
        }));
      }
    }

    await queryRunner.commitTransaction();
    console.log('✅ Hoàn tất seeding toàn bộ hệ thống!');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Seeding failed, rolled back:', err);
  } finally {
    await queryRunner.release();
    await appContext.close();
  }
}

seed().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
