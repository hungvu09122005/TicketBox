import { Controller, Post, Get, Param, Query, UseGuards, Headers, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { PaymentsService } from './payments.service';
import { RateLimitPolicy } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import type { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Authenticated — Audience initiates payment for a held order. */
  @Post(':orderId/initiate')
  @UseGuards(JwtAuthGuard, RbacGuard, RateLimitGuard)
  @RequirePermissions(Permission.ORDER_CREATE)
  @RateLimitPolicy('payment')
  @HttpCode(200)
  initiatePayment(
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.initiatePayment(
      orderId,
      user.sub,
      idempotencyKey ?? `${user.sub}:${orderId}`,
      request.ip ?? '127.0.0.1',
    );
  }

  /** Public — IPN callback from VNPAY. Signature verified inside service, NOT in controller. */
  @Get('callback/vnpay')
  handleVnpayCallback(@Query() query: Record<string, string>) {
    return this.paymentsService.handleVnpayCallback(query);
  }

  /** GET /payments/orders/:orderId/status — Check payment status */
  @Get('orders/:orderId/status')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.ORDER_READ_OWN) // Assuming user can check their own order
  getPaymentStatus(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return this.paymentsService.getPaymentStatus(orderId, user.sub, isAdmin);
  }
}
