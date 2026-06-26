import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ObjectStoragePort, UploadParams } from '../ports/object-storage.port';
import { Readable } from 'stream';

@Injectable()
export class MinioObjectStorageAdapter implements ObjectStoragePort {
  private s3: S3Client;
  private bucket = process.env.MINIO_BUCKET_NAME || 'ticketbox';

  constructor() {
    const rawEndpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
    const port = process.env.MINIO_PORT || '9000';
    const endpoint = /^https?:\/\//i.test(rawEndpoint)
      ? rawEndpoint
      : `http://${rawEndpoint}:${port}`;

    this.s3 = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true,
    });
  }

  async upload(params: UploadParams): Promise<string> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.objectKey,
      Body: params.buffer,
      ContentType: params.contentType,
    }));
    return params.objectKey;
  }

  async getPresignedUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  async download(objectKey: string): Promise<Buffer> {
    const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    const stream = await response.Body!.transformToByteArray();
    return Buffer.from(stream);
  }

  async downloadStream(objectKey: string): Promise<Readable> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
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
  }

  async delete(objectKey: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}
