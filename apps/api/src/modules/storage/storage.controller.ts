import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('test-upload')
  @UseInterceptors(FileInterceptor('file'))
  async testUpload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    
    const objectName = `test/${Date.now()}-${file.originalname}`;
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
  async testDownload(@Param('filename') filename: string) {
    const objectName = `test/${filename}`;
    const url = await this.storageService.getPresignedUrl(objectName);
    return {
      objectName,
      downloadUrl: url,
    };
  }
}
