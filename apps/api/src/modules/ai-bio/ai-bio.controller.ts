import { BadRequestException, Body, Controller, Post, Patch, Get, Query, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { AiBioService } from './ai-bio.service';

@ApiTags('ai-bio')
@ApiBearerAuth()
@Controller('api/artist-bio')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AiBioController {
  constructor(private readonly aiBioService: AiBioService) {}

  @Post()
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  @UseInterceptors(FileInterceptor('pdf'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pdf: {
          type: 'string',
          format: 'binary',
        },
        artistId: {
          type: 'string',
        },
      },
      required: ['pdf', 'artistId'],
    },
  })
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('artistId') artistId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }
    if (!artistId) {
      throw new BadRequestException('artistId is required');
    }
    return this.aiBioService.createRequest(file, artistId, user.sub);
  }

  @Post('manual')
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  @ApiBody({
  schema: {
    type: 'object',
    properties: {
      artistId: {
        type: 'string',
        example: 'c6258bff-29cb-4e4e-9422-a265e02797fc',
      },
      bio: {
        type: 'string',
        example: 'Taylor Swift là nghệ sĩ biểu diễn nổi bật, có sức ảnh hưởng lớn trong âm nhạc đại chúng.',
      },
    },
    required: ['artistId', 'bio'],
  },
})
  async createManualBio(
  @Body('artistId') artistId: string,
  @Body('bio') bio: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  if (!artistId) {
    throw new BadRequestException('artistId is required');
  }

  if (!bio || !bio.trim()) {
    throw new BadRequestException('bio is required');
  }

  return this.aiBioService.createManualBio(artistId, bio, user.sub);
}



  @Get()
  @RequirePermissions(Permission.REPORT_VIEW)
  async getAiBioJobs(@Query('status') status?: string) {
    return this.aiBioService.findAll(status);
  }

  @Get(':id/status')
  @RequirePermissions(Permission.REPORT_VIEW)
  async getAiBioJobStatus(@Param('id') id: string) {
    return this.aiBioService.findById(id);
  }

  @Patch(':id/retry')
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  async retryAiBioJob(@Param('id') id: string) {
    return this.aiBioService.retryJob(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  async updateDraftContent(
    @Param('id') id: string,
    @Body('draftContent') draftContent: string,
  ) {
    if (!draftContent || !draftContent.trim()) {
      throw new BadRequestException('draftContent is required');
    }
    return this.aiBioService.updateDraftContent(id, draftContent.trim());
  }

  @Patch(':id/publish')
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  async publishBio(@Param('id') id: string) {
    return this.aiBioService.publishBio(id);
  }
}

