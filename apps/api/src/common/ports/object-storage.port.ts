/**
 * ObjectStoragePort — dependency inversion interface for S3-compatible object storage.
 * Blueprint §01-system-design §7.2, ADR-10
 *
 * Concrete adapters:
 *   - MinioObjectStorageAdapter (apps/api/src/modules/common/adapters/minio.adapter.ts)
 *
 * RULE: All file upload/download code depends on this interface, never on MinIO SDK directly.
 */
export interface ObjectStoragePort {
  /**
   * Upload a buffer/stream to object storage.
   * @returns The object key (path within bucket) for later retrieval.
   */
  upload(params: UploadParams): Promise<string>;

  /**
   * Generate a pre-signed URL for temporary client-side download.
   */
  getPresignedUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Download an object as a buffer.
   */
  download(objectKey: string): Promise<Buffer>;

  /**
   * Delete an object from storage.
   */
  delete(objectKey: string): Promise<void>;
}

export interface UploadParams {
  /** Destination key within the bucket, e.g. 'pdfs/artist-uuid/bio.pdf' */
  objectKey: string;
  /** File content */
  buffer: Buffer;
  /** MIME type for Content-Type header */
  contentType: string;
  /** File size in bytes */
  size: number;
}

/** DI injection token */
export const OBJECT_STORAGE_PORT = 'OBJECT_STORAGE_PORT';
