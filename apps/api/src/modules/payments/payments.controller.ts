import { Controller, Post, Get, Param, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Authenticated — Audience initiates payment for a held order. */
  @Post(':orderId/initiate')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.ORDER_CREATE)
  async initiatePayment(
    @Param('orderId') orderId: string, 
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string
  ) {
    // We should pass the real IP, but for now we fallback to '127.0.0.1' if undefined
    return await this.paymentsService.initiatePayment(orderId, ipAddress || '127.0.0.1');
  }

  /** Public — IPN callback from VNPAY. Signature verified inside service, NOT in controller. */
  @Get('callback/vnpay')
  async handleVnpayCallback(@Query() query: Record<string, string>) {
    await this.paymentsService.handleVnpayCallback(query);
    return { message: 'Callback received and processed' };
  }
}
