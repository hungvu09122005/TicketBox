import { Readable } from 'stream';

export interface ObjectStoragePort {

  upload(params: UploadParams): Promise<string>;


  getPresignedUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;


  download(objectKey: string): Promise<Buffer>;
  downloadStream(objectKey: string): Promise<Readable>;


  delete(objectKey: string): Promise<void>;
}

export interface UploadParams {

  objectKey: string;

  buffer: Buffer;

  contentType: string;

  size: number;
}

export const OBJECT_STORAGE_PORT = 'OBJECT_STORAGE_PORT';
