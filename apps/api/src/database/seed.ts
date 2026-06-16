import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { Ticket, TicketStatus } from '../modules/tickets/entities/ticket.entity';

async function seed() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const dataSource = appContext.get(DataSource);
  
  const ticketRepo = dataSource.getRepository(Ticket);
  
  // Dữ liệu thật, đúng định dạng Entity
  const newTicket = ticketRepo.create({
    orderId: 'ORD-2026-001',
    ticketTypeId: 'TYPE-VIP-01',
    userId: 'USER-123',
    concertId: 'CONCERT-2026-SG',
    qrToken: 'HMAC_TOKEN_SAMPLE_XYZ_123', // Phải khớp với thuộc tính qrToken
    status: TicketStatus.ACTIVE,           // Dùng Enum đúng chuẩn
  });

  await ticketRepo.save(newTicket);
  console.log('✅ Dữ liệu thật đã được nạp vào bảng tickets!');
  
  await appContext.close();
}

seed().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});