import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile, Body, BadRequestException } from '@nestjs/common';
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
@Controller('imports')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CsvImportController {
  constructor(private readonly csvImportService: CsvImportService) {}

  @Post('csv')
  @RequirePermissions(Permission.VIP_IMPORT)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async uploadCsv(
    @UploadedFile() file: Express.Multer.File, 
    @CurrentUser() user: AuthenticatedUser,
    @Body('concertId') concertId: string
  ) {
    if (!concertId) {
      throw new BadRequestException('concertId is required');
    }
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.csvImportService.createJob(file, concertId, user.sub);
  }

  @Get(':jobId/status')
  @RequirePermissions(Permission.VIP_IMPORT)
  async getStatus(@Param('jobId') jobId: string) {
    return this.csvImportService.getJobStatus(jobId);
  }
}
