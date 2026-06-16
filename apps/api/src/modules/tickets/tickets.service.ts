import { Injectable, Inject } from '@nestjs/common';
import { QrCodeGeneratorPort, QR_CODE_GENERATOR_PORT } from '../../common/ports/qr-code-generator.port';
import { TicketsRepository } from './tickets.repository';

/**
 * TicketsService — exported surface of TicketsModule.
 *
 * Consumed by:
 *   - PaymentsModule: issueTickets(orderId, items[]) after confirmed payment
 *   - CheckinModule: verifyAndMarkUsed(qrToken, staffId, deviceId)
 *   - CsvImportModule: issueVipTicket(vipGuestId, ticketTypeId)
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    @Inject(QR_CODE_GENERATOR_PORT) private readonly qrGenerator: QrCodeGeneratorPort,
  ) {}

  async findMine(userId: string) {
    return this.ticketsRepository.findByUser(userId);
  }

  // TODO Phase 3: issueTickets, verifyQrToken, markUsed
}
