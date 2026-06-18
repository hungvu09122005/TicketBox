import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
//@UseGuards(JwtAuthGuard, RbacGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** POST /api/v1/orders — Audience creates an order (hold inventory). */
  @Post()
  @RequirePermissions(Permission.ORDER_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    // TODO Phase 3: CreateOrderDto → OrdersService.createOrder()
    return { message: 'Not implemented — Phase 3' };
  }

  /** GET /api/v1/orders/me — Audience views their own orders. */
  @Get('me')
  @RequirePermissions(Permission.ORDER_READ_OWN)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 3
    return [];
  }

  /** GET /api/v1/orders — Organizer / Admin views all orders. */
  @Get()
  @RequirePermissions(Permission.ORDER_READ_ALL)
  findAll() {
    // TODO Phase 3
    return [];
  }

  /** GET /api/v1/orders/:id — Ownership enforced in service. */
  @Get(':id')
  @RequirePermissions(Permission.ORDER_READ_OWN)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 3
    return null;
  }
}
