import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

export type SyncMeta = {
  id: string;
  deviceId: string;
  eventId: string;
  zoneId?: string | null;
  gate?: string | null;
  syncVersion: string;
  expiresAt: string;
  lastSyncAt: string;
};

export type LocalTicket = {
  ticketId: string;
  eventId: string;
  zoneId?: string | null;
  gate?: string | null;
  orderId?: string | null;
  holderName?: string | null;
  qrToken: string;
  status: string;
  rawJson: string;
  syncedAt: string;
};

export type LocalCheckinLog = {
  id: string;
  clientEventId: string;
  ticketId?: string | null;
  eventId: string;
  deviceId: string;
  gate?: string | null;
  qrToken?: string | null;
  result: 'ACCEPTED' | 'REJECTED' | 'CONFLICT';
  reason?: string | null;
  checkedInAt: string;
  syncedToServer: number;
  staffId?: string | null;
  staffEmail?: string | null;
};

const DB_NAME = 'ticketbox_checkin.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  return dbPromise;
}

function makeId() {
  return Crypto.randomUUID();
}

export async function initLocalDb() {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_meta (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      zone_id TEXT,
      gate TEXT,
      sync_version TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_sync_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS synced_tickets (
      ticket_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      zone_id TEXT,
      gate TEXT,
      order_id TEXT,
      holder_name TEXT,
      qr_token TEXT NOT NULL,
      status TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_synced_tickets_event
      ON synced_tickets(event_id);

    CREATE INDEX IF NOT EXISTS idx_synced_tickets_qr
      ON synced_tickets(qr_token);

    CREATE TABLE IF NOT EXISTS local_checkin_logs (
      id TEXT PRIMARY KEY,
      client_event_id TEXT NOT NULL UNIQUE,
      ticket_id TEXT,
      event_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      staff_id TEXT,
      staff_email TEXT,
      gate TEXT,
      qr_token TEXT,
      result TEXT NOT NULL,
      reason TEXT,
      checked_in_at TEXT NOT NULL,
      synced_to_server INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_local_logs_unsynced
      ON local_checkin_logs(synced_to_server);
  `);

  const logColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(local_checkin_logs)',
  );
  const logColumnNames = new Set(logColumns.map((column) => column.name));

  if (!logColumnNames.has('staff_id')) {
    await db.execAsync('ALTER TABLE local_checkin_logs ADD COLUMN staff_id TEXT;');
  }

  if (!logColumnNames.has('staff_email')) {
    await db.execAsync('ALTER TABLE local_checkin_logs ADD COLUMN staff_email TEXT;');
  }
}

function normalizeTicket(
  ticket: any,
  fallback: {
    eventId: string;
    zoneId?: string | null;
    gate?: string | null;
  },
): LocalTicket | null {
  const ticketId = ticket.ticketId ?? ticket.ticket_id ?? ticket.id;
  const qrToken =
    ticket.qrToken ??
    ticket.qr_token ??
    ticket.qrPayload ??
    ticket.qr_payload ??
    ticket.token;

  if (!ticketId || !qrToken) {
    return null;
  }

  return {
    ticketId,
    eventId: ticket.eventId ?? ticket.concertId ?? fallback.eventId,
    zoneId: ticket.zoneId ?? ticket.zone_id ?? fallback.zoneId ?? null,
    gate: ticket.gate ?? fallback.gate ?? null,
    orderId: ticket.orderId ?? ticket.order_id ?? null,
    holderName:
      ticket.holderName ??
      ticket.holder_name ??
      ticket.customerName ??
      ticket.customer_name ??
      null,
    qrToken,
    status: ticket.status ?? 'ACTIVE',
    rawJson: JSON.stringify(ticket),
    syncedAt: new Date().toISOString(),
  };
}

export async function replaceSyncedTickets(params: {
  deviceId: string;
  eventId: string;
  zoneId?: string | null;
  gate?: string | null;
  syncVersion: string;
  expiresAt: string;
  tickets: any[];
}) {
  const db = await getDb();
  const lastSyncAt = new Date().toISOString();

  const normalizedTickets = params.tickets
    .map((ticket) =>
      normalizeTicket(ticket, {
        eventId: params.eventId,
        zoneId: params.zoneId ?? null,
        gate: params.gate ?? null,
      }),
    )
    .filter((ticket): ticket is LocalTicket => Boolean(ticket));

  await db.execAsync('BEGIN TRANSACTION;');

  try {
    await db.runAsync(
      `
      INSERT OR REPLACE INTO sync_meta (
        id,
        device_id,
        event_id,
        zone_id,
        gate,
        sync_version,
        expires_at,
        last_sync_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        'current',
        params.deviceId,
        params.eventId,
        params.zoneId ?? null,
        params.gate ?? null,
        params.syncVersion,
        params.expiresAt,
        lastSyncAt,
      ],
    );

    await db.runAsync(
      'DELETE FROM synced_tickets WHERE event_id = ?',
      [params.eventId],
    );

    for (const ticket of normalizedTickets) {
      await db.runAsync(
        `
        INSERT OR REPLACE INTO synced_tickets (
          ticket_id,
          event_id,
          zone_id,
          gate,
          order_id,
          holder_name,
          qr_token,
          status,
          raw_json,
          synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          ticket.ticketId,
          ticket.eventId,
          ticket.zoneId ?? null,
          ticket.gate ?? null,
          ticket.orderId ?? null,
          ticket.holderName ?? null,
          ticket.qrToken,
          ticket.status,
          ticket.rawJson,
          ticket.syncedAt,
        ],
      );
    }

    await db.execAsync('COMMIT;');

    return {
      lastSyncAt,
      ticketCount: normalizedTickets.length,
    };
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

export async function getCurrentSyncMeta() {
  const db = await getDb();

  return await db.getFirstAsync<SyncMeta>(`
    SELECT
      id,
      device_id as deviceId,
      event_id as eventId,
      zone_id as zoneId,
      gate,
      sync_version as syncVersion,
      expires_at as expiresAt,
      last_sync_at as lastSyncAt
    FROM sync_meta
    WHERE id = 'current'
  `);
}

export async function countSyncedTickets() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM synced_tickets',
  );

  return row?.count ?? 0;
}

export async function findLocalTicketByQrToken(qrToken: string) {
  const db = await getDb();

  return await db.getFirstAsync<LocalTicket>(
    `
    SELECT
      ticket_id as ticketId,
      event_id as eventId,
      zone_id as zoneId,
      gate,
      order_id as orderId,
      holder_name as holderName,
      qr_token as qrToken,
      status,
      raw_json as rawJson,
      synced_at as syncedAt
    FROM synced_tickets
    WHERE qr_token = ?
    LIMIT 1
    `,
    [qrToken],
  );
}

export type LocalScanTransactionResult =
  | {
      result: 'ACCEPTED';
      clientEventId: string;
      checkedInAt: string;
      ticket: LocalTicket;
    }
  | {
      result: 'CONFLICT' | 'REJECTED';
      clientEventId: string;
      checkedInAt: string;
      ticket: LocalTicket;
      reason: string;
    };

export async function recordLocalScanTransaction(params: {
  ticketId: string;
  eventId: string;
  deviceId: string;
  staffId?: string | null;
  staffEmail?: string | null;
  gate?: string | null;
  qrToken?: string | null;
}): Promise<LocalScanTransactionResult> {
  const db = await getDb();
  const clientEventId = makeId();
  const checkedInAt = new Date().toISOString();

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');

  try {
    const ticket = await db.getFirstAsync<LocalTicket>(
      `
      SELECT
        ticket_id as ticketId,
        event_id as eventId,
        zone_id as zoneId,
        gate,
        order_id as orderId,
        holder_name as holderName,
        qr_token as qrToken,
        status,
        raw_json as rawJson,
        synced_at as syncedAt
      FROM synced_tickets
      WHERE ticket_id = ?
      LIMIT 1
      `,
      [params.ticketId],
    );

    if (!ticket) {
      const reason = 'Ticket not found in local SQLite dataset.';

      await db.runAsync(
        `
        INSERT INTO local_checkin_logs (
          id,
          client_event_id,
          ticket_id,
          event_id,
          device_id,
          staff_id,
          staff_email,
          gate,
          qr_token,
          result,
          reason,
          checked_in_at,
          synced_to_server
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `,
        [
          makeId(),
          clientEventId,
          params.ticketId,
          params.eventId,
          params.deviceId,
          params.staffId ?? null,
          params.staffEmail ?? null,
          params.gate ?? null,
          params.qrToken ?? null,
          'REJECTED',
          reason,
          checkedInAt,
        ],
      );

      await db.execAsync('COMMIT;');

      return {
        result: 'REJECTED',
        clientEventId,
        checkedInAt,
        ticket: {
          ticketId: params.ticketId,
          eventId: params.eventId,
          qrToken: params.qrToken ?? '',
          status: 'UNKNOWN',
          rawJson: '{}',
          syncedAt: checkedInAt,
        },
        reason,
      };
    }

    if (ticket.status !== 'ACTIVE') {
      const reason = `Local double-scan blocked. Status: ${ticket.status}`;

      await db.runAsync(
        `
        INSERT INTO local_checkin_logs (
          id,
          client_event_id,
          ticket_id,
          event_id,
          device_id,
          staff_id,
          staff_email,
          gate,
          qr_token,
          result,
          reason,
          checked_in_at,
          synced_to_server
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `,
        [
          makeId(),
          clientEventId,
          ticket.ticketId,
          ticket.eventId,
          params.deviceId,
          params.staffId ?? null,
          params.staffEmail ?? null,
          params.gate ?? null,
          params.qrToken ?? ticket.qrToken,
          'CONFLICT',
          reason,
          checkedInAt,
        ],
      );

      await db.execAsync('COMMIT;');

      return {
        result: 'CONFLICT',
        clientEventId,
        checkedInAt,
        ticket,
        reason,
      };
    }

    await db.runAsync(
      `
      INSERT INTO local_checkin_logs (
        id,
        client_event_id,
        ticket_id,
        event_id,
        device_id,
        staff_id,
        staff_email,
        gate,
        qr_token,
        result,
        reason,
        checked_in_at,
        synced_to_server
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        makeId(),
        clientEventId,
        ticket.ticketId,
        ticket.eventId,
        params.deviceId,
        params.staffId ?? null,
        params.staffEmail ?? null,
        params.gate ?? null,
        params.qrToken ?? ticket.qrToken,
        'ACCEPTED',
        null,
        checkedInAt,
      ],
    );

    await db.runAsync(
      `
      UPDATE synced_tickets
      SET status = 'USED'
      WHERE ticket_id = ?
        AND status = 'ACTIVE'
      `,
      [ticket.ticketId],
    );

    await db.execAsync('COMMIT;');

    return {
      result: 'ACCEPTED',
      clientEventId,
      checkedInAt,
      ticket: {
        ...ticket,
        status: 'USED',
      },
    };
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

export async function findLocalTicketByTicketId(ticketId: string) {
  const db = await getDb();

  return await db.getFirstAsync<LocalTicket>(
    `
    SELECT
      ticket_id as ticketId,
      event_id as eventId,
      zone_id as zoneId,
      gate,
      order_id as orderId,
      holder_name as holderName,
      qr_token as qrToken,
      status,
      raw_json as rawJson,
      synced_at as syncedAt
    FROM synced_tickets
    WHERE ticket_id = ?
    LIMIT 1
    `,
    [ticketId],
  );
}

export async function markLocalTicketUsed(ticketId: string) {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE synced_tickets
    SET status = 'USED'
    WHERE ticket_id = ?
    `,
    [ticketId],
  );
}

export async function saveLocalCheckinLog(params: {
  ticketId?: string | null;
  eventId: string;
  deviceId: string;
  staffId?: string | null;
  staffEmail?: string | null;
  gate?: string | null;
  qrToken?: string | null;
  result: 'ACCEPTED' | 'REJECTED' | 'CONFLICT';
  reason?: string | null;
}) {
  const db = await getDb();
  const checkedInAt = new Date().toISOString();
  const clientEventId = makeId();

  await db.runAsync(
    `
    INSERT INTO local_checkin_logs (
      id,
      client_event_id,
      ticket_id,
      event_id,
      device_id,
      staff_id,
      staff_email,
      gate,
      qr_token,
      result,
      reason,
      checked_in_at,
      synced_to_server
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `,
    [
      makeId(),
      clientEventId,
      params.ticketId ?? null,
      params.eventId,
      params.deviceId,
      params.gate ?? null,
      params.qrToken ?? null,
      params.result,
      params.reason ?? null,
      checkedInAt,
      params.staffId ?? null,
      params.staffEmail ?? null,
    ],
  );

  return {
    clientEventId,
    checkedInAt,
  };
}

export async function getUnsyncedLocalLogs() {
  const db = await getDb();

  return await db.getAllAsync<LocalCheckinLog>(`
    SELECT
      id,
      client_event_id as clientEventId,
      ticket_id as ticketId,
      event_id as eventId,
      device_id as deviceId,
      staff_id as staffId,
      staff_email as staffEmail,
      gate,
      qr_token as qrToken,
      result,
      reason,
      checked_in_at as checkedInAt,
      synced_to_server as syncedToServer
    FROM local_checkin_logs
    WHERE synced_to_server = 0
    ORDER BY checked_in_at ASC
  `);
}

export async function markLocalLogsSynced(clientEventIds: string[]) {
  if (clientEventIds.length === 0) return;

  const db = await getDb();

  for (const clientEventId of clientEventIds) {
    await db.runAsync(
      'UPDATE local_checkin_logs SET synced_to_server = 1 WHERE client_event_id = ?',
      [clientEventId],
    );
  }
}