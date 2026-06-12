import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

export const ORDER_EXPIRY_JOB = 'order.expiry';

/**
 * OrderExpiryProcessor — BullMQ worker for order hold expiry.
 * Blueprint §05-business-flows §3.1 A3.
 *
 * Job is enqueued with a delay of ORDER_HOLD_MINUTES by OrdersService.createOrder().
 * Before expiring, re-reads order from DB and verifies it is still PENDING_PAYMENT.
 * Operation is idempotent — safe to retry.
 */
@Processor('orders')
export class OrderExpiryProcessor {
  private readonly logger = new Logger(OrderExpiryProcessor.name);

  @Process(ORDER_EXPIRY_JOB)
  async handleExpiry(job: Job<{ orderId: string }>): Promise<void> {
    // TODO Phase 3:
    //   1. Re-read order from DB (idempotency: skip if not PENDING_PAYMENT)
    //   2. Begin transaction: releaseInventory + markExpired + audit log
    //   3. Invalidate availability cache
    this.logger.log(`[STUB] order-expiry job received for orderId=${job.data.orderId}`);
  }
}
