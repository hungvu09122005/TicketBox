import { Controller, Post, Patch, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { AiBioService } from './ai-bio.service';

@ApiTags('ai-bio')
@ApiBearerAuth()
@Controller('api/v1/ai/artist-bio')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AiBioController {
  constructor(private readonly aiBioService: AiBioService) {}

  @Post()
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  @UseInterceptors(FileInterceptor('pdf'))
  @ApiConsumes('multipart/form-data')
  uploadPdf(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 7: validate PDF MIME + size → AiBioService.createRequest()
    return { message: 'Not implemented — Phase 7' };
  }

  @Patch(':id/publish')
  @RequirePermissions(Permission.AI_GENERATE_BIO)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 7: AiBioService.publishDraft() — never auto-publishes
    return { message: 'Not implemented — Phase 7' };
  }
}
