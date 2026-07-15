import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { getDatabase } from '../db/database';
import { getToken } from './secureStorage';
import { checkNetworkStatus } from './network';

export const getDeviceId = async () => {
  let deviceId = await SecureStore.getItemAsync('device_id');
  if (!deviceId) {
    deviceId = Device.modelName || Device.osName || 'unknown-device';
    deviceId = `${deviceId}-${Math.random().toString(36).substring(2, 11)}`;
    await SecureStore.setItemAsync('device_id', deviceId);
  }
  return deviceId;
};

let isSyncing = false;
let retryDelay = 2000; // Start with 2 seconds backoff
let syncTimeout = null;
let listeners = [];

export const addSyncListener = (cb) => {
  listeners.push(cb);
  // Return cleanup function
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
};

const notifyListeners = (state) => {
  listeners.forEach((l) => {
    try {
      l(state);
    } catch (e) {
      console.error('Error notifying sync listener:', e);
    }
  });
};

/**
 * Main function to sync unsynced check-in logs with the backend.
 * Implements batch request, idempotency mapping, and exponential backoff retry.
 */
export const syncLogs = async () => {
  if (isSyncing) return;
  isSyncing = true;
  notifyListeners({ isSyncing: true, error: null });

  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  try {
    // 1. Check network status
    const online = await checkNetworkStatus();
    if (!online) {
      isSyncing = false;
      notifyListeners({ isSyncing: false, error: 'Offline - Waiting for connection' });
      return;
    }

    const db = getDatabase();
    
    // 2. Fetch all unsynced logs
    const unsyncedLogs = await db.getAllAsync(`
      SELECT cl.*, lt.qr_token 
      FROM checkin_logs cl
      LEFT JOIN local_tickets lt ON cl.ticket_id = lt.ticket_id
      WHERE cl.is_synced = 0
      ORDER BY cl.scanned_at ASC
    `);

    if (unsyncedLogs.length === 0) {
      isSyncing = false;
      retryDelay = 2000; // Reset backoff delay
      notifyListeners({ isSyncing: false, error: null });
      return;
    }

    console.log(`[Sync] Found ${unsyncedLogs.length} unsynced logs. Starting batch sync...`);

    // 3. Format payload matching backend CheckinDto
    const payload = unsyncedLogs.map((log) => {
      // If the ticket was unknown/not found locally, ticket_id is the QR token. 
      // We send it as qr_token, and send null for ticket_id to let backend resolve it.
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(log.ticket_id);
      
      return {
        ticket_id: isUUID ? log.ticket_id : undefined,
        qr_token: log.qr_token || log.ticket_id,
        client_event_id: log.client_event_id,
        scanned_at: log.scanned_at ? new Date(log.scanned_at).toISOString() : new Date().toISOString(),
        device_id: log.device_id || 'default-device',
      };
    });

    // 4. Retrieve authorization JWT token
    const token = await getToken();
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

    // 5. Send POST request
    const response = await fetch(`${API_URL}/checkin/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Sync HTTP error: ${response.status}`);
    }

    const json = await response.json();
    
    // NestJS TransformInterceptor wraps result in { success: true, data: ... }
    const results = json.data;

    if (!Array.isArray(results)) {
      throw new Error('Invalid response structure: expected array of sync results');
    }

    // 6. Update local SQLite database logs
    await db.withTransactionAsync(async () => {
      for (const res of results) {
        const { client_event_id, status, reason } = res;
        
        if (status === 'ACCEPTED' || status === 'SKIPPED') {
          // Success
          await db.runAsync(
            `UPDATE checkin_logs 
             SET is_synced = 1, status = 'SUCCESS', sync_at = CURRENT_TIMESTAMP, error_message = NULL, conflict_reason = NULL 
             WHERE client_event_id = ?`,
            [client_event_id]
          );
        } else if (status === 'CONFLICT') {
          // Conflict
          await db.runAsync(
            `UPDATE checkin_logs 
             SET is_synced = 1, status = 'CONFLICT', sync_at = CURRENT_TIMESTAMP, conflict_reason = ?, error_message = NULL 
             WHERE client_event_id = ?`,
            [reason || 'Duplicate scan', client_event_id]
          );
        } else if (status === 'REJECTED') {
          // Rejected
          await db.runAsync(
            `UPDATE checkin_logs 
             SET is_synced = 1, status = 'REJECTED', sync_at = CURRENT_TIMESTAMP, error_message = ?, conflict_reason = NULL 
             WHERE client_event_id = ?`,
            [reason || 'Invalid ticket', client_event_id]
          );
        }
      }
    });

    console.log('[Sync] Batch sync completed successfully.');

    // Reset backoff delay and state
    retryDelay = 2000;
    isSyncing = false;
    notifyListeners({ isSyncing: false, error: null });

    // Re-run sync to catch any logs created during active synchronization
    await syncLogs();

  } catch (error) {
    console.error('❌ [Sync] Sync error encountered:', error.message);
    isSyncing = false;
    notifyListeners({ isSyncing: false, error: error.message });

    // Schedule retry with exponential backoff
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      console.log(`[Sync] Retrying sync after ${retryDelay}ms delay...`);
      syncLogs();
    }, retryDelay);

    // Exponential increase, capped at 60 seconds
    retryDelay = Math.min(retryDelay * 2, 60000);
  }
};

// Monitor network connection transitions
NetInfo.addEventListener((state) => {
  if (state.isConnected) {
    console.log('[Sync] Network back online. Triggering automatic sync...');
    syncLogs();
  }
});
