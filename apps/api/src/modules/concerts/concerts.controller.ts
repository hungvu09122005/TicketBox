import { 
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query, DefaultValuePipe, ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
@UseGuards(OptionalJwtAuthGuard)
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) { }

  @Get()
  findPublished(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('timeFilter') timeFilter?: 'upcoming' | 'past'
  ) {
    return this.concertsService.findPublished(page, limit, timeFilter);
  }

  @Get('organizer/me')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_READ)
  findMyConcerts(@CurrentUser() user: AuthenticatedUser) {
    return this.concertsService.findOrganizerConcerts(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.concertsService.findById(id);
  }



  @Post()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.CONCERT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateConcertDto) {
    return this.concertsService.create(user.sub, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_UPDATE)
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: UpdateConcertDto) {
    const isAdmin = user.roles?.includes('ADMIN') ?? false;
    return this.concertsService.update(id, user.sub, isAdmin, body);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_UPDATE)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles?.includes('ADMIN') ?? false;
    return this.concertsService.publish(id, user.sub, isAdmin);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_UPDATE)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles?.includes('ADMIN') ?? false;
    return this.concertsService.cancel(id, user.sub, isAdmin);
  }
}