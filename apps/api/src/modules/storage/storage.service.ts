import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { ObjectStoragePort, UploadParams } from '../../common/ports/object-storage.port';
import { Readable } from 'stream';


@Injectable()
export class StorageService implements OnModuleInit, ObjectStoragePort {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private readonly defaultBucket: string;

  constructor(private configService: ConfigService) {
    this.defaultBucket = this.configService.get<string>('MINIO_BUCKET_NAME', 'ticketbox');
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'ticketbox_minio'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'ticketbox_minio_dev'),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.defaultBucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.defaultBucket, 'us-east-1');
        this.logger.log(`Created default bucket: ${this.defaultBucket}`);
      } else {
        this.logger.log(`Bucket already exists: ${this.defaultBucket}`);
      }
    } catch (error: any) {
      this.logger.error(`Error ensuring bucket exists: ${error.message}`);
    }
  }

  async upload(params: UploadParams): Promise<string> {
    try {
      await this.minioClient.putObject(
        this.defaultBucket,
        params.objectKey,
        params.buffer,
        params.size,
        { 'Content-Type': params.contentType }
      );
      this.logger.log(`File uploaded successfully: ${params.objectKey} to bucket ${this.defaultBucket}`);
      return params.objectKey;
    } catch (error: any) {
      this.logger.error(`Failed to upload file ${params.objectKey}: ${error.message}`);
      throw error;
    }
  }

  async getPresignedUrl(objectKey: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(this.defaultBucket, objectKey, expiresInSeconds);
    } catch (error: any) {
      this.logger.error(`Failed to generate presigned URL for ${objectKey}: ${error.message}`);
      throw error;
    }
  }

  async download(objectKey: string): Promise<Buffer> {
    try {
      const stream = await this.minioClient.getObject(this.defaultBucket, objectKey);
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error: any) {
      this.logger.error(`Failed to download object ${objectKey}: ${error.message}`);
      throw error;
    }
  }

    async downloadStream(objectKey: string): Promise<Readable> {
    try {
      const stream = await this.minioClient.getObject(this.defaultBucket, objectKey);
      return stream as Readable;
    } catch (error: any) {
      this.logger.error(`Failed to stream object ${objectKey}: ${error.message}`);
      throw error;
    }
  }

  async delete(objectKey: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.defaultBucket, objectKey);
      this.logger.log(`File deleted successfully: ${objectKey}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete object ${objectKey}: ${error.message}`);
      throw error;
    }
  }
}
