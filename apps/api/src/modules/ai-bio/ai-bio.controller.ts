import { BadRequestException, Body, Controller, Post, Patch, Get, Query, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { AiBioService } from './ai-bio.service';
import { AiBioTargetType } from './entities/ai-bio-request.entity';
import { RateLimitPolicy } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ApiTags('ai-bio')
@ApiBearerAuth()
@Controller('api/artist-bio')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AiBioController {
  constructor(private readonly aiBioService: AiBioService) {}

  @Post()
  @RateLimitPolicy('admin')
  @UseGuards(JwtAuthGuard, RbacGuard, RateLimitGuard)
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  @UseInterceptors(FileInterceptor('pdf'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        targetType: {
          type: 'string',
          enum: ['ARTIST', 'CONCERT'],
        },
        targetId: {
          type: 'string',
        },
        pdf: {
          type: 'string',
          format: 'binary',
        },
        artistId: {
          type: 'string',
        },
        concertId: {
          type: 'string',
        },
      },
      required: ['pdf'],
    },
  })
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('targetType') targetType: string | undefined,
    @Body('targetId') targetId: string | undefined,
    @Body('artistId') artistId: string | undefined,
    @Body('concertId') concertId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }
    const resolvedTargetType = (targetType?.toUpperCase() as AiBioTargetType | undefined)
      ?? (concertId ? AiBioTargetType.CONCERT : AiBioTargetType.ARTIST);
    const resolvedTargetId = targetId ?? artistId ?? concertId;

    if (!resolvedTargetId) {
      throw new BadRequestException('targetId is required');
    }
    return this.aiBioService.createRequest(file, resolvedTargetId, resolvedTargetType, user.sub);
  }

  @Post('manual')
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  @ApiBody({
  schema: {
    type: 'object',
    properties: {
      targetType: {
        type: 'string',
        enum: ['ARTIST', 'CONCERT'],
      },
      targetId: {
        type: 'string',
      },
      artistId: {
        type: 'string',
        example: 'c6258bff-29cb-4e4e-9422-a265e02797fc',
      },
      concertId: {
        type: 'string',
        example: 'c6258bff-29cb-4e4e-9422-a265e02797fc',
      },
      bio: {
        type: 'string',
        example: 'Taylor Swift là nghệ sĩ biểu diễn nổi bật, có sức ảnh hưởng lớn trong âm nhạc đại chúng.',
      },
    },
    required: ['bio'],
  },
})
  async createManualBio(
  @Body('targetType') targetType: string | undefined,
  @Body('targetId') targetId: string | undefined,
  @Body('artistId') artistId: string | undefined,
  @Body('concertId') concertId: string | undefined,
  @Body('bio') bio: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  if (!bio || !bio.trim()) {
    throw new BadRequestException('bio is required');
  }

  const resolvedTargetType = (targetType?.toUpperCase() as AiBioTargetType | undefined)
    ?? (concertId ? AiBioTargetType.CONCERT : AiBioTargetType.ARTIST);
  const resolvedTargetId = targetId ?? artistId ?? concertId;

  if (!resolvedTargetId) {
    throw new BadRequestException('targetId is required');
  }

  return this.aiBioService.createManualBio(resolvedTargetId, bio, user.sub, resolvedTargetType);
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
