import CryptoJS from 'crypto-js';
import type { SyncMeta } from './localDb';

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export type OfflineQrPayload = {
  ticketId: string;
  concertId: string;
  ticketTypeId: string;
};

export type OfflineQrVerifyResult =
  | {
      valid: true;
      payload: OfflineQrPayload;
    }
  | {
      valid: false;
      reason: string;
    };

export type FreshnessDecision = {
  decision: 'OK' | 'WARN' | 'BLOCK';
  message: string;
};

const DEFAULT_QR_SECRET = 'ticketbox-qr-secret';

function getQrSecret() {
  return (
    (typeof process !== 'undefined'
      ? process?.env?.EXPO_PUBLIC_QR_TOKEN_SECRET
      : undefined) || DEFAULT_QR_SECRET
  );
}

function base64UrlToBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;

  if (padding === 0) return normalized;
  return normalized + '='.repeat(4 - padding);
}

function decodeBase64UrlJson<T>(payload: string): T {
  const base64 = base64UrlToBase64(payload);
  const words = CryptoJS.enc.Base64.parse(base64);
  const json = words.toString(CryptoJS.enc.Utf8);

  if (!json) {
    throw new Error('QR payload is not valid UTF-8 JSON.');
  }

  return JSON.parse(json) as T;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

export function verifyOfflineQrToken(token: string): OfflineQrVerifyResult {
  const cleanToken = token.trim();
  const parts = cleanToken.split('.');

  if (parts.length !== 2) {
    return {
      valid: false,
      reason: 'Malformed signed QR token.',
    };
  }

  const [payload, signature] = parts;

  if (!payload || !signature) {
    return {
      valid: false,
      reason: 'QR token payload or signature is empty.',
    };
  }

  const expectedSignature = CryptoJS.HmacSHA256(payload, getQrSecret()).toString(
    CryptoJS.enc.Hex,
  );

  if (!timingSafeEqual(signature, expectedSignature)) {
    return {
      valid: false,
      reason: 'QR signature is invalid.',
    };
  }

  try {
    const decoded = decodeBase64UrlJson<Partial<OfflineQrPayload>>(payload);

    if (!decoded.ticketId || !decoded.concertId || !decoded.ticketTypeId) {
      return {
        valid: false,
        reason: 'QR payload is missing required ticket fields.',
      };
    }

    return {
      valid: true,
      payload: {
        ticketId: decoded.ticketId,
        concertId: decoded.concertId,
        ticketTypeId: decoded.ticketTypeId,
      },
    };
  } catch (error: any) {
    return {
      valid: false,
      reason: error?.message ?? 'QR payload cannot be decoded.',
    };
  }
}

export function getOfflineDatasetFreshness(meta?: SyncMeta | null): FreshnessDecision {
  if (!meta) {
    return {
      decision: 'BLOCK',
      message: 'No offline dataset has been synced to this device.',
    };
  }

  const expiresAtMs = new Date(meta.expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return {
      decision: 'BLOCK',
      message: 'Offline dataset expiry time is invalid.',
    };
  }

  const remainingMs = expiresAtMs - Date.now();

  if (remainingMs <= 0) {
    return {
      decision: 'BLOCK',
      message: 'Offline dataset is expired. Please sync before check-in.',
    };
  }

  const warnWindowMs = 2 * 60 * 60 * 1000;

  if (remainingMs <= warnWindowMs) {
    const remainingMinutes = Math.max(1, Math.floor(remainingMs / 60000));

    return {
      decision: 'WARN',
      message: `Offline dataset expires in ${remainingMinutes} minutes.`,
    };
  }

  return {
    decision: 'OK',
    message: 'Offline dataset is fresh.',
  };
}