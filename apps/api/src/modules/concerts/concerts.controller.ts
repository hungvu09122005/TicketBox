import { 
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, 
  UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
  Query, DefaultValuePipe, ParseIntPipe
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { ConcertsService } from './concerts.service';
import { Multer } from 'multer';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { RateLimitPolicy } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ApiTags('concerts')
@ApiBearerAuth()
@Controller('concerts')
@UseGuards(OptionalJwtAuthGuard)
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) { }

  @Get()
  @RateLimitPolicy('public')
  @UseGuards(RateLimitGuard)
  findPublished(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('timeFilter') timeFilter?: 'upcoming' | 'past'
  ) {
    return this.concertsService.findPublished(page, limit, timeFilter);
  }

  @Get('organizer/me')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_READ_OWN)
  findMyConcerts(@CurrentUser() user: AuthenticatedUser) {
    return this.concertsService.findOrganizerConcerts(user.sub);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_READ_ALL)
  findAllConcerts() {
    return this.concertsService.findAllConcerts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.concertsService.findById(id);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_UPDATE_ALL)
  updateAsAdmin(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: UpdateConcertDto) {
    return this.concertsService.update(id, user.sub, true, body);
  }

  @Post('admin/:id/publish')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_PUBLISH_ALL)
  publishAsAdmin(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.concertsService.publish(id, user.sub, true);
  }

  @Post('admin/:id/cancel')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_CANCEL_ALL)
  cancelAsAdmin(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.concertsService.cancel(id, user.sub, true);
  }

  // --- Logic Upload SeatMap cho Task 6 ---
  @Post(':concertId/zones/:zoneId/seat-map')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.SEATMAP_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSeatMap(
    @Param('zoneId') zoneId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 2 }), // Giới hạn 2MB
          new FileTypeValidator({ fileType: 'image/svg+xml' }),   // Chỉ nhận SVG
        ],
      }),
    ) file: Express.Multer.File,
  ) {
    return await this.concertsService.uploadSeatMap(zoneId, file);
  }
  // --------------------------------------

  @Post()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.CONCERT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateConcertDto) {
    return this.concertsService.create(user.sub, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_UPDATE_OWN)
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: UpdateConcertDto) {
    const isAdmin = user.roles?.includes('SYSTEM_ADMIN') ?? false;
    return this.concertsService.update(id, user.sub, isAdmin, body);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_PUBLISH_OWN)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles?.includes('SYSTEM_ADMIN') ?? false;
    return this.concertsService.publish(id, user.sub, isAdmin);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions(Permission.CONCERT_CANCEL_OWN)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles?.includes('SYSTEM_ADMIN') ?? false;
    return this.concertsService.cancel(id, user.sub, isAdmin);
  }
}
