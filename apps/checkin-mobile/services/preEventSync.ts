import axios from 'axios';
import {
  replaceSyncedTickets,
  getCurrentSyncMeta,
  countSyncedTickets,
} from './localDb';

type SyncDatasetPayload = {
  version: string;
  expiresAt: string;
  tickets: any[];
};

function unwrapApiResponse(responseData: any): SyncDatasetPayload {
  return responseData?.data ?? responseData;
}

export async function syncPreEventDataset(params: {
  apiBaseUrl: string;
  accessToken: string;
  deviceToken: string;
  deviceId: string;
  eventId: string;
  zoneId?: string | null;
  gate?: string | null;
}) {
  const response = await axios.get(`${params.apiBaseUrl}/checkin/sync/dataset`, {
    params: {
      deviceToken: params.deviceToken,
    },
    headers: {
      Authorization: `Bearer ${params.accessToken.trim()}`,
    },
  });

  const payload = unwrapApiResponse(response.data);

  if (!payload?.version || !payload?.expiresAt || !Array.isArray(payload.tickets)) {
    throw new Error('Sync dataset response is invalid.');
  }

  const result = await replaceSyncedTickets({
    deviceId: params.deviceId,
    eventId: params.eventId,
    zoneId: params.zoneId ?? null,
    gate: params.gate ?? null,
    syncVersion: payload.version,
    expiresAt: payload.expiresAt,
    tickets: payload.tickets,
  });

  return {
    version: payload.version,
    expiresAt: payload.expiresAt,
    lastSyncAt: result.lastSyncAt,
    ticketCount: result.ticketCount,
  };
}

export async function loadLocalSyncSummary() {
  const meta = await getCurrentSyncMeta();
  const ticketCount = await countSyncedTickets();

  return {
    meta,
    ticketCount,
  };
}

export function formatTimeToExpire(expiresAt?: string | null) {
  if (!expiresAt) return 'Chưa có dữ liệu sync';

  const ms = new Date(expiresAt).getTime() - Date.now();

  if (Number.isNaN(ms)) return 'Không xác định';
  if (ms <= 0) return 'Đã hết hạn';

  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} phút`;
  }

  return `${hours} giờ ${minutes} phút`;
}