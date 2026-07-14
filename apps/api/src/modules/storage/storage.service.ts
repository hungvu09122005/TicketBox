import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  ObjectStoragePort,
  StoredObjectInfo,
  UploadParams,
} from '../../common/ports/object-storage.port';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit, ObjectStoragePort {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client;
  private readonly defaultBucket: string;

  constructor(private configService: ConfigService) {
    this.defaultBucket = this.configService.get<string>('S3_BUCKET_NAME', 'ticketbox');
    
    const rawEndpoint = this.configService.get<string>('S3_ENDPOINT', 'localhost');
    const port = this.configService.get<string>('S3_PORT', '9000');
    
    // If endpoint starts with http/https, use it directly (like Supabase), otherwise combine host:port
    const endpoint = /^https?:\/\//i.test(rawEndpoint)
      ? rawEndpoint
      : `http://${rawEndpoint}:${port}`;

    this.s3 = new S3Client({
      endpoint,
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY', ''),
        secretAccessKey: this.configService.get<string>('S3_SECRET_KEY', ''),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    this.logger.log(`Initialized S3 storage bucket: ${this.defaultBucket}`);
  }

  async upload(params: UploadParams): Promise<string> {
    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.defaultBucket,
        Key: params.objectKey,
        Body: params.buffer,
        ContentType: params.contentType,
      }));
      this.logger.log(`File uploaded successfully: ${params.objectKey} to bucket ${this.defaultBucket}`);
      return params.objectKey;
    } catch (error: any) {
      this.logger.error(`Failed to upload file ${params.objectKey}: ${error.message}`);
      throw error;
    }
  }

  async getPresignedUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({ Bucket: this.defaultBucket, Key: objectKey });
      return await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    } catch (error: any) {
      this.logger.error(`Failed to generate presigned URL for ${objectKey}: ${error.message}`);
      throw error;
    }
  }

  async download(objectKey: string): Promise<Buffer> {
    try {
      const response = await this.s3.send(new GetObjectCommand({ Bucket: this.defaultBucket, Key: objectKey }));
      const stream = await response.Body!.transformToByteArray();
      return Buffer.from(stream);
    } catch (error: any) {
      this.logger.error(`Failed to download object ${objectKey}: ${error.message}`);
      throw error;
    }
  }

  async downloadStream(objectKey: string): Promise<Readable> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.defaultBucket,
          Key: objectKey,
        }),
      );

      const body = response.Body;

      if (!body) {
        throw new Error(`Object ${objectKey} has empty body.`);
      }

      if (body instanceof Readable) {
        return body;
      }

      if (typeof (body as any).transformToWebStream === 'function') {
        return Readable.fromWeb((body as any).transformToWebStream());
      }

      if (typeof (body as any).transformToByteArray === 'function') {
        const bytes = await (body as any).transformToByteArray();
        return Readable.from(Buffer.from(bytes));
      }

      throw new Error(`Object ${objectKey} body is not a readable stream.`);
    } catch (error: any) {
      this.logger.error(`Failed to stream object ${objectKey}: ${error.message}`);
      throw error;
    }
  }

  async listObjects(prefix: string): Promise<StoredObjectInfo[]> {
    try {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.defaultBucket,
          Prefix: prefix,
        }),
      );

      return (response.Contents ?? []).map((item) => ({
        objectKey: item.Key ?? '',
        lastModified: item.LastModified,
        size: item.Size,
      })).filter((item) => Boolean(item.objectKey));
    } catch (error: any) {
      this.logger.error(`Failed to list objects for prefix ${prefix}: ${error.message}`);
      throw error;
    }
  }

  async delete(objectKey: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.defaultBucket, Key: objectKey }));
      this.logger.log(`File deleted successfully: ${objectKey}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete object ${objectKey}: ${error.message}`);
      throw error;
    }
  }
}
