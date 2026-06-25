import { Controller, Post, Get, Body, Param, UseGuards, ForbiddenException, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';

import { RateLimitPolicy } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

import { QueueService } from './queue.service';

import { MailService } from '../../mail/mail.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, RbacGuard, RateLimitGuard)

export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly queueService: QueueService,
    private readonly mailService: MailService,
  ) {}

  /** POST /api/v1/orders/queue/status — Poll queue status */
  @Get('queue/status')
  @RequirePermissions(Permission.ORDER_CREATE)
  async getQueueStatus(
    @Query('concertId') concertId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.queueService.getQueueStatus(concertId, user.sub);
  }

  /** POST /api/v1/orders — Audience creates an order (hold inventory). */
  @Post()
  @RateLimitPolicy('order')
  @RequirePermissions(Permission.ORDER_CREATE)
  async create(
    @CurrentUser() user: AuthenticatedUser, 
    @Body() body: CreateOrderDto,
    @Res({ passthrough: true }) res: any
  ) {
    if (body.queueToken) {
      // Validate token
      const { isValid, isActive, userId } = await this.queueService.verifyAndCheckActive(body.concertId, body.queueToken);
      if (!isValid || userId !== user.sub) {
        throw new ForbiddenException('Invalid queue token');
      }
      if (!isActive) {
        throw new ForbiddenException('Queue token has expired or is not active yet');
      }
      // Process order
      return this.ordersService.createOrder(body, user.sub);
    }

    // Try to enter waiting room or checkout directly
    const queueStatus = await this.queueService.handleCheckoutRequest(body.concertId, user.sub);
    
    if (queueStatus.status === 'QUEUED') {
      res.status(202);
      return {
        message: 'System is under heavy load. You have been placed in the virtual waiting room.',
        status: 'QUEUED',
        queueToken: queueStatus.queueToken,
      };
    }

    // Proceed to create order immediately
    return this.ordersService.createOrder(body, user.sub);
  }

  /** GET /api/v1/orders/me — Audience views their own orders. */
  @Get('me')
  @RequirePermissions(Permission.ORDER_READ_OWN)
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: OrderQueryDto) {
    return this.ordersService.findByUserWithFilters(user.sub, query);
  }

  /** GET /api/v1/orders — Organizer / Admin views all orders. */
  @Get()
  @RequirePermissions(Permission.ORDER_READ_ALL)
  findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findAllWithFilters(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDER_READ_OWN)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    const order = await this.ordersService.findOne(id);
    if (!isAdmin && order.userId !== user.sub) {
      throw new ForbiddenException();
    }
    return order;
  }

  @Post('test-mail/:id')
  @RequirePermissions(Permission.ORDER_READ_ALL) // Chỉ Admin/Organizer mới được quyền test mail này
  async testSendMail(@Param('id') id: string) {
    const order = await this.ordersService.findOne(id);

    // Lấy thông tin user để gửi mail
    // Bạn cần đảm bảo đã load relation user trong findById ở Service
    await this.mailService.sendEmail({
  to: order.user.email,
  subject: '[TicketBox] Test email',
  html: `
    <h2>TicketBox Email Test</h2>
    <p>Xin chào ${order.user.name || order.user.email},</p>
    <p>Hệ thống gửi email đã hoạt động.</p>
    <p>Order ID: ${order.id}</p>
  `,
  text: `TicketBox Email Test\nOrder ID: ${order.id}`,
});
    return { message: `Email đã được gửi tới ${order.user.email}` };
  }
}
