import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { HmacQrGeneratorAdapter } from './adapters/hmac-qr-generator.adapter';
import { QR_CODE_GENERATOR_PORT } from '../../common/ports/qr-code-generator.port';

/**
 * TicketsModule — owns Ticket entity and QR token lifecycle.
 *
 * Dependency rules:
 *   - TicketsService.issueTickets() called BY PaymentsModule after confirmed payment.
 *   - CheckinModule imports TicketsModule to verify + mark USED.
 *   - QrCodeGeneratorPort fulfilled by HmacQrGeneratorAdapter.
 *   - RULE: Tickets are NEVER created before confirmed payment or valid VIP import.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Ticket])],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsRepository,
    { provide: QR_CODE_GENERATOR_PORT, useClass: HmacQrGeneratorAdapter },
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
