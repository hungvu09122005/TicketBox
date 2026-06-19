import { 
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, 
  UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator 
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

@ApiTags('concerts')
@ApiBearerAuth()
@Controller('concerts')
@UseGuards(OptionalJwtAuthGuard)
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Get()
  @RequirePermissions(Permission.CONCERT_READ_PUBLIC)
  findAll() {
    return this.concertsService.findPublished();
  }

  @Get(':id')
  @RequirePermissions(Permission.CONCERT_READ_PUBLIC)
  findOne(@Param('id') id: string) {
    return this.concertsService.findById(id);
  }

  @Post(':concertId/zones/:zoneId/seat-map')
  @RequirePermissions(Permission.SEATMAP_UPDATE)
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
  @RequirePermissions(Permission.CONCERT_UPDATE_OWN)
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return { message: 'Not implemented — Phase 2' };
  }

  @Delete(':id')
  @RequirePermissions(Permission.CONCERT_UPDATE_OWN)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return { message: 'Not implemented — Phase 2' };
  }
}