import { Controller, Post, Patch, Get, Query, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
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
      },
    },
  })
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File, 
    @CurrentUser() user: AuthenticatedUser
  ) {
    // 1. Kiểm tra file có tồn tại không
    if (!file) {
      throw new Error('PDF file is required');
    }

    // 2. Gọi Service để xử lý
    // Lưu ý: artistId cần được truyền từ client hoặc lấy từ logic nghiệp vụ
    return await this.aiBioService.createRequest(file, 'your-artist-id', user.sub);
  }

  @Get()
  @RequirePermissions(Permission.REPORT_VIEW)
  async getAiBioJobs(@Query('status') status?: string) {
    return this.aiBioService.findAll(status as any);
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
}
