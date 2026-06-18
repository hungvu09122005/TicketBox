import { Controller, Post, Get, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('api/v1/orders')
//@UseGuards(JwtAuthGuard, RbacGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** POST /api/v1/orders — Audience creates an order (hold inventory). */
  @Post()
  @RequirePermissions(Permission.ORDER_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body, user.sub);
  }

  /** GET /api/v1/orders/me — Audience views their own orders. */
  @Get('me')
  @RequirePermissions(Permission.ORDER_READ_OWN)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findByUser(user.sub);
  }

  /** GET /api/v1/orders — Organizer / Admin views all orders. */
  @Get()
  @RequirePermissions(Permission.ORDER_READ_ALL)
  findAll() {
    // TODO Phase 3
    return [];
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDER_READ_OWN)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    const order = await this.ordersService.findById(id);
    if (!isAdmin && order.userId !== user.sub) {
      throw new ForbiddenException();
    }
    return order;
  }
}
