import { Controller, Post, Get, Param, Query, UseGuards, UseInterceptors, UploadedFile, Body, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { CsvImportService } from './csv-import.service';
import { CsvImportJobStatus } from './entities/csv-import-job.entity';

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

  @Post('csv/storage-sync')
  @RequirePermissions(Permission.VIP_IMPORT)
  async enqueueStoredCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Body('concertId') concertId: string,
    @Body('objectKey') objectKey: string,
  ) {
    if (!concertId) {
      throw new BadRequestException('concertId is required');
    }
    if (!objectKey) {
      throw new BadRequestException('objectKey is required');
    }
    return this.csvImportService.createJobFromObjectKey(concertId, user.sub, objectKey);
  }

  @Get('template')
  @RequirePermissions(Permission.VIP_IMPORT)
  async getTemplate() {
    return {
      filename: 'vip-import-template.csv',
      delimiter: ',',
      encoding: 'utf-8',
      requiredColumns: ['email', 'full_name', 'ticket_type'],
      optionalColumns: ['phone', 'sponsor', 'gate', 'note'],
      columns: [
        {
          name: 'email',
          required: true,
          description: 'Guest email, used for deduplication',
        },
        {
          name: 'full_name',
          required: true,
          description: 'Guest name to store in VIP guest list',
        },
        {
          name: 'phone',
          required: false,
          description: 'Optional phone number',
        },
        {
          name: 'ticket_type',
          required: true,
          description: 'Ticket type label from sponsor CSV, mapped inside the selected concert',
        },
      ],
      exampleRows: [
        {
          email: 'guest1@example.com',
          full_name: 'Guest 1',
          phone: '0900000001',
          ticket_type: 'VIP',
        },
        {
          email: 'guest2@example.com',
          full_name: 'Guest 2',
          phone: '0900000002',
          ticket_type: 'VIP',
        },
      ],
      notes: [
        'Accepted aliases: name/full_name and ticketTypeId/ticket_type.',
        'Upload one CSV file per concert.',
        'Backend validates each row and supports partial success.',
        'Rows with duplicate email or invalid ticketTypeId are written into the error report.',
      ],
    };
  }

  @Get(':jobId/status')
  @RequirePermissions(Permission.VIP_IMPORT)
  async getStatus(@Param('jobId') jobId: string) {
    return this.csvImportService.getJobStatus(jobId);
  }

  @Get(':jobId/error-report')
  @RequirePermissions(Permission.VIP_IMPORT)
  async getErrorReport(@Param('jobId') jobId: string) {
    return this.csvImportService.getErrorReport(jobId);
  }

  @Get()
  @RequirePermissions(Permission.VIP_IMPORT)
  async listJobs(@Query('status') status?: CsvImportJobStatus) {
    return this.csvImportService.listJobs(status);
  }

  @Post(':jobId/retry')
  @RequirePermissions(Permission.VIP_IMPORT)
  async retryJob(@Param('jobId') jobId: string) {
    return this.csvImportService.retryJob(jobId);
  }
}
