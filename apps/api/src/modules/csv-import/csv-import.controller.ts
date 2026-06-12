import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { CsvImportService } from './csv-import.service';

@ApiTags('csv-import')
@ApiBearerAuth()
@Controller('api/v1/imports')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CsvImportController {
  constructor(private readonly csvImportService: CsvImportService) {}

  @Post('csv')
  @RequirePermissions(Permission.VIP_IMPORT)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  uploadCsv(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    // TODO Phase 6: validate MIME (text/csv), size, headers → CsvImportService.createJob()
    return { message: 'Not implemented — Phase 6' };
  }

  @Get(':jobId/status')
  @RequirePermissions(Permission.VIP_IMPORT)
  getStatus(@Param('jobId') jobId: string) {
    // TODO Phase 6
    return { message: 'Not implemented — Phase 6' };
  }
}
