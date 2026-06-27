import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.enum';
import { StorageService } from './storage.service';
import { sanitizeFilename, validateFileExtension, validateMimeType, validateFileSize } from '../../common/utils/file-validation.util';

const MAX_TEST_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TEST_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/csv',
]);

const ALLOWED_TEST_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.pdf', '.csv',
]);

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
@UseGuards(JwtAuthGuard, RbacGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('test-upload')
  @RequirePermissions(Permission.REPORT_VIEW)
  @UseInterceptors(FileInterceptor('file'))
  async testUpload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate MIME type
    validateMimeType(file.mimetype, ALLOWED_TEST_MIME_TYPES);

    // Validate file extension
    validateFileExtension(file.originalname, ALLOWED_TEST_EXTENSIONS);

    // Validate file size
    validateFileSize(file.size, MAX_TEST_UPLOAD_SIZE);

    // Sanitize filename to prevent path traversal
    const safeName = sanitizeFilename(file.originalname);
    const objectName = `test/${Date.now()}-${safeName}`;

    await this.storageService.upload({
      objectKey: objectName,
      buffer: file.buffer,
      size: file.size,
      contentType: file.mimetype,
    });
    
    return {
      message: 'File uploaded successfully',
      objectName,
    };
  }

  @Get('test-download/:filename')
  @RequirePermissions(Permission.REPORT_VIEW)
  async testDownload(@Param('filename') filename: string) {
    // Sanitize filename to prevent path traversal (e.g., ../../secret/key)
    const safeName = sanitizeFilename(filename);
    const objectName = `test/${safeName}`;

    const url = await this.storageService.getPresignedUrl(objectName);
    return {
      objectName,
      downloadUrl: url,
    };
  }
}
