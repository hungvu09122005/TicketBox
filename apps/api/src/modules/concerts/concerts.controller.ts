import { 
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, 
  UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { ConcertsService } from './concerts.service';

@ApiTags('concerts')
@ApiBearerAuth()
@Controller('api/v1/concerts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Get()
  @RequirePermissions(Permission.CONCERT_READ)
  findAll() {
    return this.concertsService.findPublished();
  }

  @Get(':id')
  @RequirePermissions(Permission.CONCERT_READ)
  findOne(@Param('id') id: string) {
    return this.concertsService.findById(id);
  }

  // --- Logic Upload SeatMap cho Task 6 ---
  @Post(':concertId/zones/:zoneId/seat-map')
  @RequirePermissions(Permission.CONCERT_UPDATE)
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
  @RequirePermissions(Permission.CONCERT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return { message: 'Not implemented — Phase 2' };
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return { message: 'Not implemented — Phase 2' };
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONCERT_UPDATE)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return { message: 'Not implemented — Phase 2' };
  }
}