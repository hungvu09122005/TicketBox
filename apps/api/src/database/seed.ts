import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { seedRbac } from './seed-rbac';
import { Ticket, TicketStatus } from '../modules/tickets/entities/ticket.entity';
import { User } from '../modules/users/entities/user.entity';
import { Concert, ConcertStatus } from '../modules/concerts/entities/concert.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { Artist } from '../modules/artists/entities/artist.entity';
import { TicketType } from '../modules/ticket-types/entities/ticket-type.entity';
import { OrderStatus } from '../modules/orders/enums/order-status.enum';
async function seed() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const dataSource = appContext.get(DataSource);

  console.log('🚀 Đang chạy full seed...');

  await seedRbac(dataSource);

  const userRepo = dataSource.getRepository(User);
  const artistRepo = dataSource.getRepository(Artist);
  const concertRepo = dataSource.getRepository(Concert);
  const ticketTypeRepo = dataSource.getRepository(TicketType);
  const orderRepo = dataSource.getRepository(Order);
  const ticketRepo = dataSource.getRepository(Ticket);

  // 1. User
  let user = await userRepo.findOne({ where: { email: 'user@ticketbox.com' } });
  if (!user) {
    user = await userRepo.save(userRepo.create({ 
      email: 'user@ticketbox.com', name: 'Test User',
      passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p366/n3k.c5z7n9O/s.kY45a',
      isActive: true
    }));
  }

  // 2. Artist
  let artist = await artistRepo.findOne({ where: { name: 'Taylor Swift' } });
  if (!artist) {
    artist = await artistRepo.save(artistRepo.create({ name: 'Taylor Swift' }));
  }

  // 3. Concert
  let concert = await concertRepo.findOne({ where: { name: 'Summer Music Fest 2026' } });
  if (!concert) {
    concert = await concertRepo.save(concertRepo.create({ 
      name: 'Summer Music Fest 2026',
      artistId: artist.id, organizerId: user.id,
      status: ConcertStatus.DRAFT,
      startsAt: new Date(), endsAt: new Date(Date.now() + 86400000),
      venue: 'HCMC Stadium'
    }));
  }

  // 4. TicketType
  let ticketType = await ticketTypeRepo.findOne({ where: { concertId: concert.id } });
  if (!ticketType) {
    ticketType = await ticketTypeRepo.save(ticketTypeRepo.create({
      name: 'VIP', price: 1000000, totalQuantity: 100, maxPerUser: 4, concertId: concert.id
    }));
  }

  // 5. Order & Ticket
  const order = await orderRepo.save(orderRepo.create({ 
    userId: user.id, concertId: concert.id, ticketTypeId: ticketType.id,
    quantity: 1, totalAmount: 1000000, expiresAt: new Date(Date.now() + 3600000),
    status: OrderStatus.PENDING_PAYMENT
  }));

  await ticketRepo.save(ticketRepo.create({
    orderId: order.id, ticketTypeId: ticketType.id, userId: user.id,
    concertId: concert.id, qrToken: 'HMAC_TOKEN_SAMPLE_XYZ_123',
    status: TicketStatus.ACTIVE
  }));

  console.log('✅ Hoàn tất seeding toàn bộ hệ thống!');
  await appContext.close();
}

seed().catch((err) => { console.error(err); process.exit(1); });