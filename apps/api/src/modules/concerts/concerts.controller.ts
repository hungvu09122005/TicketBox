import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { ConcertsService } from './concerts.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';

@ApiTags('concerts')
@ApiBearerAuth()
@Controller('concerts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Get()
  @RequirePermissions(Permission.CONCERT_READ)
  findAll() {
    return this.concertsService.findPublished();
  }

  @Get('organizer/me')
  @RequirePermissions(Permission.CONCERT_READ)
  findMyConcerts(@CurrentUser() user: AuthenticatedUser) {
    return this.concertsService.findOrganizerConcerts(user.sub);
  }

  @Get(':id')
  @RequirePermissions(Permission.CONCERT_READ)
  findOne(@Param('id') id: string) {
    return this.concertsService.findById(id);
  }

  @Post()
  @RequirePermissions(Permission.CONCERT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateConcertDto) {
    return this.concertsService.createConcert(user.sub, body);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: UpdateConcertDto) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return this.concertsService.updateConcert(id, user.sub, body, isAdmin);
  }

  @Post(':id/publish')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return this.concertsService.publishConcert(id, user.sub, isAdmin);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes('SYSTEM_ADMIN');
    return this.concertsService.cancelConcert(id, user.sub, isAdmin);
  }
}
