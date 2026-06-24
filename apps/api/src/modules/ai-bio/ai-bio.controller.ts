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
  async updateDraft(
    @Param('id') id: string,
    @Body('draftContent') draftContent: string,
  ) {
    if (!draftContent?.trim()) {
      throw new BadRequestException('draftContent is required');
    }

    return this.aiBioService.updateDraft(id, draftContent);
  }

  @Patch(':id/publish')
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  async publishDraft(@Param('id') id: string) {
    return this.aiBioService.publishDraft(id);
  }
}
