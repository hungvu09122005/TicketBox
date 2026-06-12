import { Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Authenticated — Audience initiates payment for a held order. */
  @Post(':orderId/initiate')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.ORDER_CREATE)
  initiatePayment(@Param('orderId') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 3 — returns { paymentUrl }
    return { message: 'Not implemented — Phase 3' };
  }

  /** Public — IPN callback from VNPAY. Signature verified inside service, NOT in controller. */
  @Get('callback/vnpay')
  handleVnpayCallback(@Query() query: Record<string, string>) {
    // TODO Phase 3 — no auth guard; service verifies VNPAY HMAC signature
    return { message: 'Not implemented — Phase 3' };
  }
}
