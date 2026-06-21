import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { TicketTypesService } from './ticket-types.service';
import { ConcertsService } from '../concerts/concerts.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';

@ApiTags('ticket-types')
@ApiBearerAuth()
@Controller('concerts/:concertId/ticket-types')
@UseGuards(OptionalJwtAuthGuard)
export class TicketTypesController {
  constructor(
    private readonly ticketTypesService: TicketTypesService,
    private readonly concertsService: ConcertsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.TICKET_TYPE_CREATE)
  async createTicketType(
    @Param('concertId') concertId: string,
    @Body() dto: CreateTicketTypeDto,
    @Request() req: any,
  ) {
    const isAdmin = req.user.roles.includes('SYSTEM_ADMIN');
    await this.concertsService.checkOwnership(concertId, req.user.sub, isAdmin);
    return this.ticketTypesService.create(concertId, dto, req.user.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.TICKET_TYPE_UPDATE)
  async updateTicketType(
    @Param('concertId') concertId: string,
    @Param('id') ticketTypeId: string,
    @Body() dto: UpdateTicketTypeDto,
    @Request() req: any,
  ) {
    const isAdmin = req.user.roles.includes('SYSTEM_ADMIN');
    await this.concertsService.checkOwnership(concertId, req.user.sub, isAdmin);
    return this.ticketTypesService.update(ticketTypeId, dto, req.user.sub);
  }

  @Get()
<<<<<<< HEAD
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.TICKET_TYPE_READ)
  async findByConcert(@Param('concertId') concertId: string) {
    return this.ticketTypesService.findByConcertId(concertId);
  }

  @Get('availability')
=======
  @RequirePermissions(Permission.TICKET_TYPE_READ)
  findByConcert(@Param('concertId') concertId: string) {
    // TODO Phase 2
    return [];
  }

  @Get('availability')
  @RequirePermissions(Permission.TICKET_TYPE_READ)
>>>>>>> 94c0007 (feat(rbac): finish RBAC migration, seeding, and controller permissions)
  getAvailability(@Param('concertId') concertId: string) {
    return this.ticketTypesService.getPublicAvailability(concertId);
  }
}
