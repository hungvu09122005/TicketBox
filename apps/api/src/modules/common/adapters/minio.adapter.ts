import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { ObjectStoragePort, UploadParams } from '../../../common/ports/object-storage.port';
import { Readable } from 'stream';

type MinioConfig = {
  endpoint: string;
  port: number;
  useSsl: boolean;
  accessKey: string;
  secretKey: string;
  bucketName: string;
};

@Injectable()
export class MinioObjectStorageAdapter implements ObjectStoragePort {
  private readonly client: Client;
  private readonly bucketName: string;
  private bucketReady = false;

  constructor(configService: ConfigService) {
    const minio = configService.get<MinioConfig>('app.minio');
    if (!minio) {
      throw new Error('Missing MinIO configuration.');
    }

    this.bucketName = minio.bucketName;
    this.client = new Client({
      endPoint: minio.endpoint,
      port: minio.port,
      useSSL: minio.useSsl,
      accessKey: minio.accessKey,
      secretKey: minio.secretKey,
    });
  }

  async upload(params: UploadParams): Promise<string> {
    await this.ensureBucket();
    await this.client.putObject(
      this.bucketName,
      params.objectKey,
      params.buffer,
      params.size,
      { 'Content-Type': params.contentType },
    );
    return params.objectKey;
  }

  async getPresignedUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureBucket();
    return this.client.presignedGetObject(this.bucketName, objectKey, expiresInSeconds);
  }

  async download(objectKey: string): Promise<Buffer> {
    await this.ensureBucket();
    const stream = await this.client.getObject(this.bucketName, objectKey);
    return this.streamToBuffer(stream);
  }

    async downloadStream(objectKey: string): Promise<Readable> {
    await this.ensureBucket();
    const stream = await this.client.getObject(this.bucketName, objectKey);
    return stream as Readable;
  }

  async delete(objectKey: string): Promise<void> {
    await this.ensureBucket();
    await this.client.removeObject(this.bucketName, objectKey);
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;

    const exists = await this.client.bucketExists(this.bucketName);
    if (!exists) {
      await this.client.makeBucket(this.bucketName);
    }

    this.bucketReady = true;
  }

  private streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
