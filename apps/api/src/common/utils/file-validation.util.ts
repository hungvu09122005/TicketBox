import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

/**
 * Sanitize a filename to prevent path traversal attacks.
 * Strips directory components, null bytes, and dangerous characters.
 *
 * @param filename - The raw filename from the client
 * @returns The sanitized basename
 * @throws BadRequestException if the filename is empty or dangerous after sanitization
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) {
    throw new BadRequestException('Filename is required');
  }

  // Remove null bytes
  let sanitized = filename.replace(/\0/g, '');

  // Extract only the basename (strip any directory traversal)
  sanitized = path.basename(sanitized);

  // Remove any remaining path separators or dangerous characters
  sanitized = sanitized.replace(/[\/\\]/g, '');

  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new BadRequestException('Invalid filename');
  }

  return sanitized;
}

/**
 * Validate that a filename has an allowed extension.
 *
 * @param filename - The filename to check
 * @param allowedExtensions - Set of allowed lowercase extensions (e.g., '.csv', '.pdf')
 * @throws BadRequestException if the extension is not in the allowlist
 */
export function validateFileExtension(
  filename: string,
  allowedExtensions: Set<string>,
): void {
  const ext = path.extname(filename).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    throw new BadRequestException(
      `Invalid file extension "${ext}". Allowed: ${Array.from(allowedExtensions).join(', ')}`,
    );
  }
}

/**
 * Validate that a MIME type is within the allowlist.
 *
 * @param mimetype - The MIME type from the upload
 * @param allowedMimeTypes - Set of allowed MIME type strings
 * @throws BadRequestException if the MIME type is not allowed
 */
export function validateMimeType(
  mimetype: string,
  allowedMimeTypes: Set<string>,
): void {
  if (!allowedMimeTypes.has(mimetype)) {
    throw new BadRequestException(
      `Invalid MIME type "${mimetype}". Allowed: ${Array.from(allowedMimeTypes).join(', ')}`,
    );
  }
}

/**
 * Validate that a file does not exceed the maximum allowed size.
 *
 * @param size - File size in bytes
 * @param maxBytes - Maximum allowed size in bytes
 * @throws BadRequestException if the file exceeds the limit
 */
export function validateFileSize(size: number, maxBytes: number): void {
  if (size > maxBytes) {
    const maxMB = (maxBytes / (1024 * 1024)).toFixed(1);
    throw new BadRequestException(
      `File too large. Maximum allowed size is ${maxMB} MB.`,
    );
  }
}
