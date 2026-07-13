import { DataSource, Repository } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Artist } from '../modules/artists/entities/artist.entity';
import { Concert, ConcertStatus } from '../modules/concerts/entities/concert.entity';
import { TicketType } from '../modules/ticket-types/entities/ticket-type.entity';
import { SeatZone } from '../modules/seat-map/entities/seat-zone.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { OrderItem } from '../modules/orders/entities/order-item.entity';
import { Payment, PaymentStatus } from '../modules/payments/entities/payment.entity';
import { Ticket, TicketStatus } from '../modules/tickets/entities/ticket.entity';
import {
  NotificationLog,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../modules/notifications/entities/notification-log.entity';
import {
  CheckinLog,
  CheckinMode,
  CheckinStatus,
} from '../modules/checkin/entities/checkin-log.entity';
import {
  CsvImportJob,
  CsvImportJobStatus,
} from '../modules/csv-import/entities/csv-import-job.entity';
import { CsvImportRow, CsvRowStatus } from '../modules/csv-import/entities/csv-import-row.entity';
import { VipGuest } from '../modules/csv-import/entities/vip-guest.entity';
import { AiBioRequest, AiBioStatus, AiBioTargetType } from '../modules/ai-bio/entities/ai-bio-request.entity';
import { OrderStatus } from '../modules/orders/enums/order-status.enum';

const seedIds = {
  artistOne: '2c5d8d0f-3f58-4eb5-87ff-4fa0b622c501',
  artistTwo: 'd9b13f28-66d4-4f7d-9d8d-1c0a12ccf502',
  concertOne: '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
  concertTwo: 'f4d8b3c9-1f39-4c1d-ae18-9b0d2ff8c602',
  concertThree: '8a4c2d40-3a12-4b7d-b851-3b6e5de4c603',
  concertFour: '8a4c2d40-3a12-4b7d-b851-3b6e5de4c604',
  ticketTypeVip: '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac701',
  ticketTypeStandard: '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac702',
  ticketTypeBackstage: '9d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
  ticketTypeThreeVip: '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
  ticketTypeThreeStd: '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac704',
  ticketTypeFourVip: '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac705',
  ticketTypeFourStd: '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac706',
  seatZoneA: '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd801',
  seatZoneB: '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd802',
  seatZoneThreeA: '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd803',
  seatZoneThreeB: '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd804',
  seatZoneFourA: '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd805',
  seatZoneFourB: '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd806',
  orderPaid: 'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e901',
  orderPending: 'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e902',
  orderItemPaid: 'bb8fa3b1-7fcb-4f1e-8f25-65fcbde5ea01',
  orderItemPending: 'bb8fa3b1-7fcb-4f1e-8f25-65fcbde5ea02',
  paymentConfirmed: 'cc8fa3b1-7fcb-4f1e-8f25-65fcbde5eb01',
  paymentPending: 'cc8fa3b1-7fcb-4f1e-8f25-65fcbde5eb02',
  ticketOne: 'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec01',
  ticketTwo: 'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec02',
  ticketThree: 'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec03',
  notificationOne: 'ee8fa3b1-7fcb-4f1e-8f25-65fcbde5ed01',
  notificationTwo: 'ee8fa3b1-7fcb-4f1e-8f25-65fcbde5ed02',
  checkinAccepted: 'ff8fa3b1-7fcb-4f1e-8f25-65fcbde5ee01',
  checkinRejected: 'ff8fa3b1-7fcb-4f1e-8f25-65fcbde5ee02',
  csvJob: '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef01',
  csvRowOne: '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef11',
  csvRowTwo: '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef12',
  csvRowThree: '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef13',
  vipGuestOne: '222fa3b1-7fcb-4f1e-8f25-65fcbde5f001',
  vipGuestTwo: '222fa3b1-7fcb-4f1e-8f25-65fcbde5f002',
  aiBioOne: '333fa3b1-7fcb-4f1e-8f25-65fcbde5f101',
};

async function saveEntity<T extends { id: string }>(
  repo: Repository<T>,
  values: Partial<T> & { id: string },
): Promise<T> {
  return repo.save(values as T);
}

export async function resetSeedTables(dataSource: DataSource) {
  await dataSource.query(`
    TRUNCATE TABLE
      "notification_logs",
      "checkin_logs",
      "csv_import_rows",
      "csv_import_jobs",
      "vip_guests",
      "payments",
      "tickets",
      "order_items",
      "orders",
      "seat_zones",
      "ticket_types",
      "concerts",
      "artists",
      "users",
      "role_permissions",
      "user_roles",
      "permissions",
      "roles",
      "ai_bio_requests"
    RESTART IDENTITY CASCADE;
  `);
}

export async function seedFullData(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const artistRepo = dataSource.getRepository(Artist);
  const concertRepo = dataSource.getRepository(Concert);
  const ticketTypeRepo = dataSource.getRepository(TicketType);
  const seatZoneRepo = dataSource.getRepository(SeatZone);
  const orderRepo = dataSource.getRepository(Order);
  const orderItemRepo = dataSource.getRepository(OrderItem);
  const paymentRepo = dataSource.getRepository(Payment);
  const ticketRepo = dataSource.getRepository(Ticket);
  const notificationRepo = dataSource.getRepository(NotificationLog);
  const checkinRepo = dataSource.getRepository(CheckinLog);
  const csvJobRepo = dataSource.getRepository(CsvImportJob);
  const csvRowRepo = dataSource.getRepository(CsvImportRow);
  const vipGuestRepo = dataSource.getRepository(VipGuest);
  const aiBioRepo = dataSource.getRepository(AiBioRequest);

  const [admin, organizer, audience, staff] = await Promise.all([
    userRepo.findOneOrFail({ where: { email: 'admin@ticketbox.local' } }),
    userRepo.findOneOrFail({ where: { email: 'organizer@ticketbox.local' } }),
    userRepo.findOneOrFail({ where: { email: 'audience@ticketbox.local' } }),
    userRepo.findOneOrFail({ where: { email: 'staff@ticketbox.local' } }),
  ]);

  const artistOne = await saveEntity(artistRepo, {
    id: seedIds.artistOne,
    name: 'The Neon Waves',
    shortBio: 'Electronic pop band seeded for local development.',
    avatarObjectKey: 'artists/the-neon-waves/avatar.png',
  });

  const artistTwo = await saveEntity(artistRepo, {
    id: seedIds.artistTwo,
    name: 'Midnight Echo',
    shortBio: 'Acoustic duo used to populate the concert catalogue.',
    avatarObjectKey: 'artists/midnight-echo/avatar.png',
  });

  const concertOne = await saveEntity(concertRepo, {
    id: seedIds.concertOne,
    name: 'Summer Pulse Live 2026',
    artists: [artistOne],
    organizerId: organizer.id,
    status: ConcertStatus.PUBLISHED,
    startsAt: new Date('2026-08-15T12:00:00.000Z'),
    endsAt: new Date('2026-08-15T15:00:00.000Z'),
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-08-10T23:59:59.000Z'),
    venue: 'Saigon Exhibition and Convention Center',
    description: 'Main seeded concert for audience and organizer workflows.',
    bannerObjectKey: 'concerts/summer-pulse-live-2026/banner.jpg',
  });

  const concertTwo = await saveEntity(concertRepo, {
    id: seedIds.concertTwo,
    name: 'Acoustic Night Session',
    artists: [artistTwo],
    organizerId: organizer.id,
    status: ConcertStatus.DRAFT,
    startsAt: new Date('2026-10-20T11:00:00.000Z'),
    endsAt: new Date('2026-10-20T13:00:00.000Z'),
    saleStartsAt: new Date('2026-09-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-10-15T23:59:59.000Z'),
    venue: 'TicketBox Hall',
    description: 'Secondary draft concert for management screens.',
    bannerObjectKey: 'concerts/acoustic-night-session/banner.jpg',
  });

  const concertThree = await saveEntity(concertRepo, {
    id: seedIds.concertThree,
    name: 'Rock Arena 2026',
    artists: [artistOne],
    organizerId: organizer.id,
    status: ConcertStatus.PUBLISHED,
    startsAt: new Date('2026-09-05T18:00:00.000Z'),
    endsAt: new Date('2026-09-05T21:00:00.000Z'),
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-09-01T23:59:59.000Z'),
    venue: 'Hanoi Stadium',
    description: 'Rock Arena concert for tests.',
    bannerObjectKey: 'concerts/rock-arena-2026/banner.jpg',
  });

  const concertFour = await saveEntity(concertRepo, {
    id: seedIds.concertFour,
    name: 'Pop Deluxe Fest 2026',
    artists: [artistTwo],
    organizerId: organizer.id,
    status: ConcertStatus.PUBLISHED,
    startsAt: new Date('2026-09-25T19:00:00.000Z'),
    endsAt: new Date('2026-09-25T22:00:00.000Z'),
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-09-20T23:59:59.000Z'),
    venue: 'Da Nang Center',
    description: 'Pop Deluxe concert for tests.',
    bannerObjectKey: 'concerts/pop-deluxe-fest-2026/banner.jpg',
  });

  const ticketTypeVip = await saveEntity(ticketTypeRepo, {
    id: seedIds.ticketTypeVip,
    concertId: concertOne.id,
    name: 'VIP',
    price: 1800000,
    totalQuantity: 120,
    soldQuantity: 12,
    heldQuantity: 4,
    maxPerUser: 4,
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-08-10T23:59:59.000Z'),
  });

  const ticketTypeStandard = await saveEntity(ticketTypeRepo, {
    id: seedIds.ticketTypeStandard,
    concertId: concertOne.id,
    name: 'Standard',
    price: 750000,
    totalQuantity: 400,
    soldQuantity: 180,
    heldQuantity: 25,
    maxPerUser: 6,
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-08-10T23:59:59.000Z'),
  });

  const ticketTypeBackstage = await saveEntity(ticketTypeRepo, {
    id: seedIds.ticketTypeBackstage,
    concertId: concertTwo.id,
    name: 'Backstage',
    price: 2200000,
    totalQuantity: 50,
    soldQuantity: 0,
    heldQuantity: 0,
    maxPerUser: 2,
    saleStartsAt: new Date('2026-09-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-10-15T23:59:59.000Z'),
  });

  const ticketTypeThreeVip = await saveEntity(ticketTypeRepo, {
    id: seedIds.ticketTypeThreeVip,
    concertId: concertThree.id,
    name: 'VIP',
    price: 2000000,
    totalQuantity: 100,
    soldQuantity: 0,
    heldQuantity: 0,
    maxPerUser: 4,
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-09-01T23:59:59.000Z'),
  });

  const ticketTypeThreeStd = await saveEntity(ticketTypeRepo, {
    id: seedIds.ticketTypeThreeStd,
    concertId: concertThree.id,
    name: 'Standard',
    price: 800000,
    totalQuantity: 300,
    soldQuantity: 0,
    heldQuantity: 0,
    maxPerUser: 6,
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-09-01T23:59:59.000Z'),
  });

  const ticketTypeFourVip = await saveEntity(ticketTypeRepo, {
    id: seedIds.ticketTypeFourVip,
    concertId: concertFour.id,
    name: 'VIP',
    price: 2500000,
    totalQuantity: 80,
    soldQuantity: 0,
    heldQuantity: 0,
    maxPerUser: 4,
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-09-20T23:59:59.000Z'),
  });

  const ticketTypeFourStd = await saveEntity(ticketTypeRepo, {
    id: seedIds.ticketTypeFourStd,
    concertId: concertFour.id,
    name: 'Standard',
    price: 900000,
    totalQuantity: 250,
    soldQuantity: 0,
    heldQuantity: 0,
    maxPerUser: 6,
    saleStartsAt: new Date('2026-07-01T00:00:00.000Z'),
    saleEndsAt: new Date('2026-09-20T23:59:59.000Z'),
  });

  await saveEntity(seatZoneRepo, {
    id: seedIds.seatZoneA,
    concertId: concertOne.id,
    name: 'Zone A',
    svgObjectKey: 'seat-maps/summer-pulse-live-2026/zone-a.svg',
    ticketTypeId: ticketTypeVip.id,
  });

  await saveEntity(seatZoneRepo, {
    id: seedIds.seatZoneB,
    concertId: concertOne.id,
    name: 'Zone B',
    svgObjectKey: 'seat-maps/summer-pulse-live-2026/zone-b.svg',
    ticketTypeId: ticketTypeStandard.id,
  });

  await saveEntity(seatZoneRepo, {
    id: seedIds.seatZoneThreeA,
    concertId: concertThree.id,
    name: 'Zone A',
    svgObjectKey: 'seat-maps/rock-arena-2026/zone-a.svg',
    ticketTypeId: ticketTypeThreeVip.id,
  });

  await saveEntity(seatZoneRepo, {
    id: seedIds.seatZoneThreeB,
    concertId: concertThree.id,
    name: 'Zone B',
    svgObjectKey: 'seat-maps/rock-arena-2026/zone-b.svg',
    ticketTypeId: ticketTypeThreeStd.id,
  });

  await saveEntity(seatZoneRepo, {
    id: seedIds.seatZoneFourA,
    concertId: concertFour.id,
    name: 'Zone A',
    svgObjectKey: 'seat-maps/pop-deluxe-fest-2026/zone-a.svg',
    ticketTypeId: ticketTypeFourVip.id,
  });

  await saveEntity(seatZoneRepo, {
    id: seedIds.seatZoneFourB,
    concertId: concertFour.id,
    name: 'Zone B',
    svgObjectKey: 'seat-maps/pop-deluxe-fest-2026/zone-b.svg',
    ticketTypeId: ticketTypeFourStd.id,
  });

  const paidOrder = await saveEntity(orderRepo, {
    id: seedIds.orderPaid,
    userId: audience.id,
    concertId: concertOne.id,
    ticketTypeId: ticketTypeStandard.id,
    quantity: 2,
    totalAmount: 1500000,
    expiresAt: new Date('2026-07-10T12:15:00.000Z'),
    status: OrderStatus.PAID,
  });

  const pendingOrder = await saveEntity(orderRepo, {
    id: seedIds.orderPending,
    userId: audience.id,
    concertId: concertTwo.id,
    ticketTypeId: ticketTypeBackstage.id,
    quantity: 1,
    totalAmount: 2200000,
    expiresAt: new Date('2026-07-12T12:15:00.000Z'),
    status: OrderStatus.PENDING_PAYMENT,
  });

  await saveEntity(orderItemRepo, {
    id: seedIds.orderItemPaid,
    orderId: paidOrder.id,
    ticketTypeId: ticketTypeStandard.id,
    quantity: 2,
    unitPrice: 750000,
  });

  await saveEntity(orderItemRepo, {
    id: seedIds.orderItemPending,
    orderId: pendingOrder.id,
    ticketTypeId: ticketTypeBackstage.id,
    quantity: 1,
    unitPrice: 2200000,
  });

  await saveEntity(paymentRepo, {
    id: seedIds.paymentConfirmed,
    orderId: paidOrder.id,
    idempotencyKey: 'payment-paid-order-001',
    providerTxId: 'VNPAY-PAID-001',
    provider: 'VNPAY',
    amount: 1500000,
    status: PaymentStatus.CONFIRMED,
    rawCallback: { status: '00', bankCode: 'VCB', transactionNo: '1234567890' },
  });

  await saveEntity(paymentRepo, {
    id: seedIds.paymentPending,
    orderId: pendingOrder.id,
    idempotencyKey: 'payment-pending-order-001',
    providerTxId: 'MOMO-PENDING-001',
    provider: 'MOMO',
    amount: 2200000,
    status: PaymentStatus.PENDING,
    rawCallback: { status: 'PROCESSING' },
  });

  const ticketOne = await saveEntity(ticketRepo, {
    id: seedIds.ticketOne,
    orderId: paidOrder.id,
    ticketTypeId: ticketTypeStandard.id,
    userId: audience.id,
    concertId: concertOne.id,
    qrToken: 'qr-token-ticket-001',
    status: TicketStatus.ACTIVE,
  });

  const ticketTwo = await saveEntity(ticketRepo, {
    id: seedIds.ticketTwo,
    orderId: paidOrder.id,
    ticketTypeId: ticketTypeStandard.id,
    userId: audience.id,
    concertId: concertOne.id,
    qrToken: 'qr-token-ticket-002',
    status: TicketStatus.USED,
  });

  const ticketThree = await saveEntity(ticketRepo, {
    id: seedIds.ticketThree,
    orderId: pendingOrder.id,
    ticketTypeId: ticketTypeBackstage.id,
    userId: audience.id,
    concertId: concertTwo.id,
    qrToken: 'qr-token-ticket-003',
    status: TicketStatus.ACTIVE,
  });

  await saveEntity(notificationRepo, {
    id: seedIds.notificationOne,
    ticketId: ticketOne.id,
    userId: audience.id,
    type: NotificationType.TICKET_CONFIRMATION,
    channel: NotificationChannel.EMAIL,
    status: NotificationStatus.SENT,
    sentAt: new Date('2026-07-10T12:20:00.000Z'),
  });

  await saveEntity(notificationRepo, {
    id: seedIds.notificationTwo,
    ticketId: ticketTwo.id,
    userId: audience.id,
    type: NotificationType.REMINDER_24H,
    channel: NotificationChannel.EMAIL,
    status: NotificationStatus.QUEUED,
  });

  await saveEntity(checkinRepo, {
    id: seedIds.checkinAccepted,
    ticketId: ticketOne.id,
    staffId: staff.id,
    deviceId: 'scanner-device-01',
    mode: CheckinMode.ONLINE,
    status: CheckinStatus.ACCEPTED,
    clientEventId: 'client-event-001',
    scannedAt: new Date('2026-08-15T12:10:00.000Z'),
    syncAt: new Date('2026-08-15T12:10:01.000Z'),
  });

  await saveEntity(checkinRepo, {
    id: seedIds.checkinRejected,
    ticketId: ticketThree.id,
    staffId: staff.id,
    deviceId: 'scanner-device-01',
    mode: CheckinMode.OFFLINE,
    status: CheckinStatus.REJECTED,
    conflictReason: 'Ticket not paid yet.',
    clientEventId: 'client-event-002',
    scannedAt: new Date('2026-08-15T12:15:00.000Z'),
  });

  const csvJob = await saveEntity(csvJobRepo, {
    id: seedIds.csvJob,
    concertId: concertOne.id,
    triggeredBy: organizer.id,
    objectKey: 'imports/vip-guests/summer-pulse.csv',
    status: CsvImportJobStatus.COMPLETED,
    totalRows: 3,
    successRows: 2,
    errorRows: 1,
  });

  await saveEntity(csvRowRepo, {
    id: seedIds.csvRowOne,
    jobId: csvJob.id,
    rowNumber: 1,
    status: CsvRowStatus.SUCCESS,
  });

  await saveEntity(csvRowRepo, {
    id: seedIds.csvRowTwo,
    jobId: csvJob.id,
    rowNumber: 2,
    status: CsvRowStatus.SUCCESS,
  });

  await saveEntity(csvRowRepo, {
    id: seedIds.csvRowThree,
    jobId: csvJob.id,
    rowNumber: 3,
    status: CsvRowStatus.ERROR,
    errorReason: 'Invalid email address',
  });

  await saveEntity(vipGuestRepo, {
    id: seedIds.vipGuestOne,
    concertId: concertOne.id,
    ticketTypeId: ticketTypeVip.id,
    csvImportJobId: csvJob.id,
    email: 'vip1@ticketbox.local',
    phone: '+84900000001',
    name: 'VIP Guest One',
    dedupKey: 'vip1@ticketbox.local',
    ticketId: ticketOne.id,
  });

  await saveEntity(vipGuestRepo, {
    id: seedIds.vipGuestTwo,
    concertId: concertOne.id,
    ticketTypeId: ticketTypeVip.id,
    csvImportJobId: csvJob.id,
    email: 'vip2@ticketbox.local',
    phone: '+84900000002',
    name: 'VIP Guest Two',
    dedupKey: 'vip2@ticketbox.local',
  });

  await saveEntity(aiBioRepo, {
    id: seedIds.aiBioOne,
    targetId: artistOne.id,
    targetType: AiBioTargetType.ARTIST,
    requestedBy: admin.id,
    pdfObjectKey: 'ai-bio/the-neon-waves.pdf',
    status: AiBioStatus.PUBLISHED,
    draftContent: 'Generated biography content for The Neon Waves.',
  });

  console.log('✅ Core business data seeded');
}
