import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
ActivityIndicator,
Pressable,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
TextInput,
Vibration,
View,
} from 'react-native';
import {
BarcodeScanningResult,
CameraView as ExpoCameraView,
useCameraPermissions,
} from 'expo-camera';
import * as Crypto from 'expo-crypto';
import axios from 'axios';

import {
findLocalTicketByQrToken, findLocalTicketByTicketId,
getUnsyncedLocalLogs,
initLocalDb, recordLocalScanTransaction,
markLocalLogsSynced,
saveLocalCheckinLog,
type SyncMeta,
} from './services/localDb';
import {
formatTimeToExpire,
loadLocalSyncSummary,
syncPreEventDataset,
} from './services/preEventSync';

import NetInfo from '@react-native-community/netinfo';

import {
  getOfflineDatasetFreshness,
  verifyOfflineQrToken,
} from './services/offlineQr';
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.17:3001/api/v1';
const CameraView = ExpoCameraView as any;
const SCAN_COOLDOWN_SECONDS = 10;

type ResultType = 'idle' | 'accepted' | 'rejected' | 'already-used';

type ConcertOption = {
  id: string;
  name: string;
  venue?: string;
  status?: string;
  startsAt?: string;
};

function unwrapApiResponse<T = any>(responseData: any): T {
return responseData?.data ?? responseData;
}

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    const base64 = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);

    return JSON.parse(atob(base64)) as T;
  } catch {
    return null;
  }
}

function getStaffFromAccessToken(accessToken: string) {
  const payload = accessToken.trim().split('.')[1];

  if (!payload) {
    return {
      staffId: null,
      staffEmail: null,
    };
  }

  const decoded = decodeBase64UrlJson<{
    sub?: string;
    email?: string;
  }>(payload);

  return {
    staffId: decoded?.sub ?? null,
    staffEmail: decoded?.email ?? null,
  };
}

export default function App() {
const [permission, requestPermission] = useCameraPermissions();

const [accessToken, setAccessToken] = useState('');
const [loginEmail, setLoginEmail] = useState('');
const [loginPassword, setLoginPassword] = useState('');
const [isLoggedIn, setIsLoggedIn] = useState(false);
const [staffEmail, setStaffEmail] = useState<string | null>(null);

const [deviceId, setDeviceId] = useState('');
const [deviceToken, setDeviceToken] = useState('');
const [deviceName, setDeviceName] = useState('Gate A Device');
const [concertId, setConcertId] = useState('');
const [selectedConcertName, setSelectedConcertName] = useState('');
const [concerts, setConcerts] = useState<ConcertOption[]>([]);
const [concertsLoading, setConcertsLoading] = useState(false);
const [gate, setGate] = useState('A1');
const [activeTab, setActiveTab] = useState<'home' | 'scan' | 'sync' | 'settings'>('home');

const [manualCode, setManualCode] = useState('');
const [loading, setLoading] = useState(false);
const [scanned, setScanned] = useState(false);
const [scanCooldownSeconds, setScanCooldownSeconds] = useState(0);
const scanCooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const [message, setMessage] = useState('');
const [resultType, setResultType] = useState<ResultType>('idle');

const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
const [localTicketCount, setLocalTicketCount] = useState(0);
const [unsyncedLogCount, setUnsyncedLogCount] = useState(0);

const timeToExpire = useMemo(
() => formatTimeToExpire(syncMeta?.expiresAt),
[syncMeta?.expiresAt],
);

const selectedConcert = concerts.find((concert) => concert.id === concertId);

const authHeaders = () => ({
'Content-Type': 'application/json',
Authorization: `Bearer ${accessToken.trim()}`,
});

const parseConcerts = (responseData: any): ConcertOption[] => {
  const data = unwrapApiResponse<any>(responseData);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const loadConcerts = async (token?: string) => {
  setConcertsLoading(true);

  try {
      const response = await axios.get(
  `${API_BASE_URL}/checkin/concerts`, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
      timeout: 10000,
    });

    const list = parseConcerts(response.data);
    setConcerts(list);

    if (list.length > 0) {
      const currentSelected = list.find((concert) => concert.id === concertId);

      const nextConcert =
        currentSelected ??
        list.find((concert) => concert.status === 'PUBLISHED') ??
        list[0];

      setConcertId(nextConcert.id);
      setSelectedConcertName(nextConcert.name);
      setResultType('idle');
      setMessage(`Đã tải ${list.length} sự kiện.`);
    } else {
      setSelectedConcertName('');
      setResultType('rejected');
      setMessage('API trả về danh sách sự kiện rỗng. Hãy kiểm tra seed dữ liệu concert.');
    }
  } catch (error: any) {
    setConcerts([]);
    setSelectedConcertName('');
    setResultType('rejected');
    setMessage(
      `Không tải được danh sách sự kiện: ${
        error?.response?.data?.message ?? error?.message ?? 'Unknown error'
      }`,
    );
  } finally {
    setConcertsLoading(false);
  }
};

const login = async () => {
  if (loading) return;

  if (!loginEmail.trim() || !loginPassword.trim()) {
    setResultType('rejected');
    setMessage('Vui lòng nhập email và mật khẩu.');
    return;
  }

  setLoading(true);

  try {
    const response = await axios.post(
  `${API_BASE_URL}/auth/login`,
  {
    email: loginEmail.trim(),
    password: loginPassword,
  },
  {
    timeout: 10000,
  },
);

    const data = unwrapApiResponse<any>(response.data);

    const token =
      data?.accessToken ??
      data?.token ??
      data?.tokens?.accessToken;

    if (!token) {
      throw new Error('API không trả về accessToken.');
    }

    const staff = getStaffFromAccessToken(token);

    setAccessToken(token);
    setStaffEmail(staff.staffEmail ?? loginEmail.trim());
    setIsLoggedIn(true);
    setLoginPassword('');
    setResultType('accepted');
    setMessage('Đăng nhập thành công.');
    await loadConcerts(token);
    Vibration.vibrate(120);
  } catch (error: any) {
    setResultType('rejected');
    setMessage(
      `Đăng nhập thất bại: ${
        error?.response?.data?.message ?? error?.message ?? 'Unknown error'
      }`,
    );
    Vibration.vibrate([0, 300]);
  } finally {
    setLoading(false);
  }
};

const logout = () => {
  setAccessToken('');
  setLoginPassword('');
  setIsLoggedIn(false);
  setStaffEmail(null);
  setDeviceId('');
  setDeviceToken('');
  setConcertId('');
  setSelectedConcertName('');
  setConcerts([]);
  setResultType('idle');
  setMessage('Đã đăng xuất.');
};

const refreshLocalSummary = async () => {
const summary = await loadLocalSyncSummary();
const logs = await getUnsyncedLocalLogs();


setSyncMeta(summary.meta ?? null);
setLocalTicketCount(summary.ticketCount);
setUnsyncedLogCount(logs.length);

if (summary.meta) {
  setDeviceId((current) => current || summary.meta?.deviceId || '');
  setConcertId((current) => current || summary.meta?.eventId || '');
  setGate((current) => current || summary.meta?.gate || 'A1');
}


};

useEffect(() => {
const bootstrap = async () => {
try {
await initLocalDb();
await refreshLocalSummary();
} catch (error: any) {
setResultType('rejected');
        setMessage(`SQLite init failed: ${error?.message ?? "Unknown error"}`);
}
};


bootstrap();


}, []);

const registerDevice = async () => {
if (loading) return;


if (!accessToken.trim()) {
  setResultType('rejected');
      setMessage("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
  return;
}

if (!concertId.trim()) {
  setResultType('rejected');
      setMessage("Vui lòng chọn sự kiện trước khi đăng ký thiết bị.");
  return;
}

setLoading(true);

try {
  const response = await axios.post(
    `${API_BASE_URL}/checkin/devices/register`,
    {
      deviceName: deviceName.trim(),
      concertId: concertId.trim(),
      gate: gate.trim() || undefined,
    },
    {
      headers: authHeaders(),
    },
  );

  const data = unwrapApiResponse<any>(response.data);
  const newDeviceId = data?.deviceId;
  const newDeviceToken = data?.token;

  if (!newDeviceId || !newDeviceToken) {
        throw new Error("API did not return deviceId/token.");
  }

  setDeviceId(newDeviceId);
  setDeviceToken(newDeviceToken);
  setResultType('accepted');
      setMessage("Đăng ký thiết bị thành công. Bạn có thể đồng bộ dữ liệu vé.");
  Vibration.vibrate(120);
} catch (error: any) {
  setResultType('rejected');
  setMessage(
        `Register device failed: ${
      error?.response?.data?.message ?? error?.message ?? 'Unknown error'
    }`,
  );
  Vibration.vibrate([0, 300]);
} finally {
  setLoading(false);
}


};

const syncPreEvent = async () => {
if (loading) return;

if (!accessToken.trim()) {
  setResultType('rejected');
      setMessage("Access token is required to sync dataset.");
  return;
}

if (!deviceId || !deviceToken) {
  setResultType('rejected');
      setMessage("Please register device before syncing.");
  return;
}

if (!concertId.trim()) {
  setResultType('rejected');
      setMessage("ConcertId is required to save local dataset.");
  return;
}

setLoading(true);

try {
  const result = await syncPreEventDataset({
    apiBaseUrl: API_BASE_URL,
    accessToken,
    deviceToken,
    deviceId,
    eventId: concertId.trim(),
    gate: gate.trim() || null,
  });

  await refreshLocalSummary();

  setResultType('accepted');
  setMessage(
        `Sync completed: ${result.ticketCount} tickets. Expires: ${new Date(
      result.expiresAt,
    ).toLocaleString()}`,
  );
  Vibration.vibrate(120);
} catch (error: any) {
  setResultType('rejected');
  setMessage(
        `Sync failed: ${
      error?.response?.data?.message ?? error?.message ?? 'Unknown error'
    }`,
  );
  Vibration.vibrate([0, 300]);
} finally {
  setLoading(false);
}


};

const validateQrToken = async (qrToken: string) => {
  if (loading) return;

  const cleanToken = qrToken.trim();

  if (!cleanToken) {
    setResultType('rejected');
    setMessage('QR token is empty.');
    return;
  }

  if (!deviceId) {
    setResultType('rejected');
    setMessage('Device is not registered or not loaded from SQLite.');
    return;
  }

  setLoading(true);

  try {
    const networkState = await NetInfo.fetch();
    const isOffline =
      networkState.isConnected !== true ||
      networkState.isInternetReachable === false;

    const localSummary = await loadLocalSyncSummary();
    const currentMeta = localSummary.meta ?? syncMeta;
    const freshness = getOfflineDatasetFreshness(currentMeta);

    const rejectLocally = async (reason: string, ticketId?: string | null) => {
      const staff = getStaffFromAccessToken(accessToken);

      await saveLocalCheckinLog({
        ticketId: ticketId ?? null,
        eventId: currentMeta?.eventId || concertId || 'unknown',
        deviceId,
        staffId: staff.staffId,
        staffEmail: staff.staffEmail,
        gate,
        qrToken: cleanToken,
        result: 'REJECTED',
        reason,
      });

      await refreshLocalSummary();

      setResultType('rejected');
      setMessage(reason);
      Vibration.vibrate([0, 300]);
    };

    if (isOffline && freshness.decision === 'BLOCK') {
      await rejectLocally(`Offline blocked. ${freshness.message}`);
      return;
    }

    const signedQr = verifyOfflineQrToken(cleanToken);

    if (isOffline && !signedQr.valid) {
      await rejectLocally(`Offline rejected. ${signedQr.reason}`);
      return;
    }

    if (
      isOffline &&
      currentMeta?.gate &&
      gate.trim() &&
      currentMeta.gate !== gate.trim()
    ) {
      await rejectLocally(
        `Offline rejected. Device dataset is for gate ${currentMeta.gate}, current gate is ${gate.trim()}.`,
      );
      return;
    }

    let localTicket = signedQr.valid
      ? await findLocalTicketByTicketId(signedQr.payload.ticketId)
      : null;

    if (!localTicket) {
      localTicket = await findLocalTicketByQrToken(cleanToken);
    }

    if (localTicket) {
      if (signedQr.valid && localTicket.ticketId !== signedQr.payload.ticketId) {
        await rejectLocally('Offline rejected. QR payload does not match local ticket.');
        return;
      }

      if (signedQr.valid && localTicket.eventId !== signedQr.payload.concertId) {
        await rejectLocally('Offline rejected. QR event does not match local dataset.');
        return;
      }

      const activeGate = gate.trim() || currentMeta?.gate || '';

      if (localTicket.gate && activeGate && localTicket.gate !== activeGate) {
        await rejectLocally(
          `Offline rejected. Ticket is scoped to gate ${localTicket.gate}, current gate is ${activeGate}.`,
          localTicket.ticketId,
        );
        return;
      }

      const staff = getStaffFromAccessToken(accessToken);

      const txResult = await recordLocalScanTransaction({
        ticketId: localTicket.ticketId,
        eventId: localTicket.eventId,
        deviceId,
        staffId: staff.staffId,
        staffEmail: staff.staffEmail,
        gate,
        qrToken: cleanToken,
      });

      await refreshLocalSummary();

      const freshnessPrefix =
        isOffline && freshness.decision === 'WARN'
          ? `Warning: ${freshness.message}\n`
          : '';

      if (txResult.result === 'ACCEPTED') {
        setResultType('accepted');
        setMessage(
          `${freshnessPrefix}Offline accepted. Ticket: ${txResult.ticket.ticketId}\nEvent: ${txResult.clientEventId}\nAt: ${txResult.checkedInAt}`,
        );
        Vibration.vibrate(120);
      } else {
        setResultType('already-used');
        setMessage(
          `${freshnessPrefix}Local double-scan blocked. Ticket: ${txResult.ticket.ticketId}\nEvent: ${txResult.clientEventId}\nAt: ${txResult.checkedInAt}\nReason: ${txResult.reason}`,
        );
        Vibration.vibrate([0, 120, 80, 120]);
      }

      return;
    }

    if (isOffline) {
      await rejectLocally('Offline rejected. Ticket not found in local SQLite dataset.');
      return;
    }

    if (!accessToken.trim()) {
      const staff = getStaffFromAccessToken(accessToken);

      await saveLocalCheckinLog({
        eventId: concertId || syncMeta?.eventId || 'unknown',
        deviceId,
        staffId: staff.staffId,
        staffEmail: staff.staffEmail,
        gate,
        qrToken: cleanToken,
        result: 'REJECTED',
        reason: 'Ticket not found in local dataset',
      });

      await refreshLocalSummary();

      setResultType('rejected');
      setMessage(
        'Ticket not found in local SQLite dataset and no access token for online validation.',
      );
      Vibration.vibrate([0, 300]);
      return;
    }

    const response = await axios.post(
      `${API_BASE_URL}/checkin/validate`,
      {
        qr_token: cleanToken,
        client_event_id: Crypto.randomUUID(),
        device_id: deviceId,
      },
      {
        headers: authHeaders(),
      },
    );

    const data = unwrapApiResponse<any>(response.data);

    setResultType('accepted');
    setMessage(`Online accepted. Log: ${data?.id ?? 'OK'}`);
    Vibration.vibrate(120);
  } catch (error: any) {
    const msg = error?.response?.data?.message ?? error?.message ?? 'Unknown error';
    const lowerMsg = String(msg).toLowerCase();

    if (
      lowerMsg.includes('used') ||
      lowerMsg.includes('already') ||
      lowerMsg.includes('already used') ||
      lowerMsg.includes('used ticket') ||
      lowerMsg.includes('ticket already')
    ) {
      setResultType('already-used');
      setMessage(`Ticket has already been used. ${msg}`);
      Vibration.vibrate([0, 120, 80, 120]);
    } else {
      setResultType('rejected');
      setMessage(`Check-in failed: ${msg}`);
      Vibration.vibrate([0, 300]);
    }
  } finally {
    setLoading(false);
  }
};



const syncOfflineLogs = async () => {
if (loading) return;


if (!accessToken.trim()) {
  setResultType('rejected');
      setMessage("Access token is required to push offline logs to backend.");
  return;
}

const logs = await getUnsyncedLocalLogs();

if (logs.length === 0) {
  setResultType('accepted');
      setMessage("No offline logs need syncing.");
  return;
}

setLoading(true);

try {
  const payload = logs.map((log) => ({
    ticket_id: log.ticketId || undefined,
    qr_token: log.qrToken || undefined,
    client_event_id: log.clientEventId,
    scanned_at: log.checkedInAt,
    device_id: log.deviceId,
  }));

  await axios.post(`${API_BASE_URL}/checkin/sync`, payload, {
    headers: authHeaders(),
  });

  await markLocalLogsSynced(logs.map((log) => log.clientEventId));
  await refreshLocalSummary();

  setResultType('accepted');
      setMessage(`Synced ${logs.length} offline logs to backend.`);
  Vibration.vibrate(120);
} catch (error: any) {
  setResultType('rejected');
  setMessage(
        `Sync offline logs failed: ${
      error?.response?.data?.message ?? error?.message ?? 'Unknown error'
    }`,
  );
  Vibration.vibrate([0, 300]);
} finally {
  setLoading(false);
}


};

const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
  if (scanned || loading || scanCooldownSeconds > 0) return;

  setScanned(true);
  setScanCooldownSeconds(SCAN_COOLDOWN_SECONDS);

  await validateQrToken(result.data);

  if (scanCooldownIntervalRef.current) {
    clearInterval(scanCooldownIntervalRef.current);
  }

  scanCooldownIntervalRef.current = setInterval(() => {
    setScanCooldownSeconds((current) => {
      if (current <= 1) {
        if (scanCooldownIntervalRef.current) {
          clearInterval(scanCooldownIntervalRef.current);
          scanCooldownIntervalRef.current = null;
        }

        setScanned(false);
        return 0;
      }

      return current - 1;
    });
  }, 1000);
};

const handleManualSubmit = () => {
validateQrToken(manualCode);
setManualCode('');
};

const resetDevice = () => {
setDeviceId('');
setDeviceToken('');
    setMessage("Device id was cleared. You can register this device again.");
setResultType('idle');
};


  if (!isLoggedIn) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>TicketBox</Text>
        </View>

        <Text style={styles.headerTitle}>Đăng nhập Check-in</Text>
        <Text style={styles.headerSubtitle}>
          Dành cho nhân viên soát vé tại cổng sự kiện.
        </Text>
      </View>

      <View style={styles.loginContainer}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tài khoản nhân viên</Text>

          <TextInput
            style={styles.input}
            value={loginEmail}
            onChangeText={setLoginEmail}
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            value={loginPassword}
            onChangeText={setLoginPassword}
            placeholder="Mật khẩu"
            secureTextEntry
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={login}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Text>
          </Pressable>
        </View>

        {!!message && (
          <View
            style={[
              styles.resultBox,
              resultType === 'accepted' && styles.acceptedBox,
              resultType === 'rejected' && styles.rejectedBox,
            ]}
          >
            <Text style={styles.resultText}>{message}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator />
          <Text>Checking camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Text style={styles.permissionTitle}>Camera permission required</Text>
          <Text style={styles.permissionText}>
            This app needs camera access to scan ticket QR codes.
          </Text>

          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant camera permission</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>TicketBox</Text>
        </View>

        <Text style={styles.headerTitle}>TicketBox Check-in</Text>
        <Text style={styles.headerSubtitle}>
          Xin chào, {staffEmail ?? 'Nhân viên soát vé'}
        </Text>
        <View style={styles.bottomNav}>
        {[
          ['home', 'Trang chủ'],
          ['scan', 'Quét QR'],
          ['sync', 'Đồng bộ'],
          ['settings', 'Cài đặt'],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.navItem, activeTab === key && styles.navItemActive]}
            onPress={() => setActiveTab(key as any)}
          >
            <Text
              style={[
                styles.navText,
                activeTab === key && styles.navTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      </View>

      <ScrollView style={styles.panel} keyboardShouldPersistTaps="handled">
  {activeTab === 'home' && (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Sự kiện đang chọn</Text>
        <Text style={styles.heroTitle}>
          {selectedConcertName || selectedConcert?.name || 'Chưa chọn sự kiện'}
        </Text>
        <Text style={styles.heroMeta}>
          {selectedConcert?.venue ?? 'Chưa có địa điểm'}
        </Text>
        <Text style={styles.statusBadge}>
          {selectedConcert?.status ?? 'N/A'}
        </Text>

        <Pressable
          style={styles.primaryAction}
          onPress={() => setActiveTab('scan')}
        >
          <Text style={styles.primaryActionText}>Quét QR</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thiết bị check-in</Text>
        <Text style={styles.metaText}>Nhân viên: {staffEmail ?? 'N/A'}</Text>

        <TextInput
          style={styles.input}
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="Tên thiết bị"
        />

        <Text style={styles.fieldLabel}>Chọn sự kiện</Text>

        {concerts.map((concert) => {
          const selected = concert.id === concertId;

          return (
            <Pressable
              key={concert.id}
              style={[
                styles.concertOption,
                selected && styles.concertOptionSelected,
              ]}
              onPress={() => {
                setConcertId(concert.id);
                setSelectedConcertName(concert.name);
                setResultType('idle');
                setMessage(`Đã chọn sự kiện: ${concert.name}`);
              }}
            >
              <Text style={styles.concertName}>
                {selected ? '✓ ' : ''}
                {concert.name}
              </Text>
              <Text style={styles.concertMeta}>
                📍 {concert.venue ?? 'Chưa có địa điểm'}
              </Text>
              <Text style={styles.concertMeta}>
                Trạng thái: {concert.status ?? 'N/A'}
              </Text>
            </Pressable>
          );
        })}

        <TextInput
          style={styles.input}
          value={gate}
          onChangeText={setGate}
          placeholder="Cổng check-in"
        />

        {!deviceId ? (
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={registerDevice}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Đang đăng ký...' : 'Đăng ký thiết bị'}
            </Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.deviceText}>Thiết bị: {deviceId}</Text>
            <Text style={styles.deviceText}>
              Sự kiện: {selectedConcertName || concertId || 'N/A'}
            </Text>

            <Pressable
              style={[styles.secondaryButton, loading && styles.buttonDisabled]}
              onPress={resetDevice}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>
                Đăng ký thiết bị khác
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </>
  )}

  {activeTab === 'scan' && (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Quét mã QR</Text>
      <Text style={styles.metaText}>
        Đưa mã QR vé vào khung camera để kiểm tra.
      </Text>

      <CameraView
        style={styles.scanCamera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
  !deviceId || scanned || scanCooldownSeconds > 0
    ? undefined
    : handleBarcodeScanned
}
      />

      {!deviceId && (
        <Text style={{ color: '#ef4444', fontWeight: 'bold', marginTop: 10, textAlign: 'center' }}>
          ⚠️ Bạn chưa đăng ký thiết bị! Hãy vào tab "Trang chủ" để đăng ký trước khi quét.
        </Text>
      )}

      {scanCooldownSeconds > 0 && (
        <Text style={styles.cooldownText}>
          Vui lòng đợi {scanCooldownSeconds}s trước khi quét mã tiếp theo.
        </Text>
      )}

      <Pressable
  style={styles.secondaryButton}
  onPress={() => {
    if (scanCooldownIntervalRef.current) {
      clearInterval(scanCooldownIntervalRef.current);
      scanCooldownIntervalRef.current = null;
    }

    setScanCooldownSeconds(0);
    setScanned(false);
  }}
>
  <Text style={styles.secondaryButtonText}>Quét mã khác</Text>
</Pressable>
    </View>
  )}

  {activeTab === 'sync' && (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Đồng bộ dữ liệu</Text>

      <Text style={styles.metaText}>
        Lần đồng bộ cuối:{' '}
        {syncMeta?.lastSyncAt
          ? new Date(syncMeta.lastSyncAt).toLocaleString()
          : 'Chưa đồng bộ'}
      </Text>

      <Text style={styles.metaText}>
        Hết hạn:{' '}
        {syncMeta?.expiresAt
          ? new Date(syncMeta.expiresAt).toLocaleString()
          : 'N/A'}
      </Text>

      <Text style={styles.metaText}>Thời hạn dữ liệu: {timeToExpire}</Text>
      <Text style={styles.metaText}>Vé local: {localTicketCount}</Text>
      <Text style={styles.metaText}>Log chưa đồng bộ: {unsyncedLogCount}</Text>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={syncPreEvent}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu vé'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, loading && styles.buttonDisabled]}
        onPress={syncOfflineLogs}
        disabled={loading}
      >
        <Text style={styles.secondaryButtonText}>Đồng bộ log offline</Text>
      </Pressable>
    </View>
  )}

  {activeTab === 'settings' && (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Kiểm tra thủ công</Text>

        <TextInput
          style={styles.input}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Nhập hoặc dán QR Token"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleManualSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Đang kiểm tra...' : 'Xác nhận vé'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tài khoản</Text>
        <Text style={styles.metaText}>Nhân viên: {staffEmail ?? 'N/A'}</Text>

        <Pressable style={styles.secondaryButton} onPress={logout}>
          <Text style={styles.secondaryButtonText}>Đăng xuất</Text>
        </Pressable>
      </View>
    </>
  )}

  {!!message && (
    <View
      style={[
        styles.resultBox,
        resultType === 'accepted' && styles.acceptedBox,
        resultType === 'rejected' && styles.rejectedBox,
        resultType === 'already-used' && styles.alreadyUsedBox,
      ]}
    >
      <Text style={styles.resultText}>{message}</Text>
    </View>
  )}
</ScrollView>

    

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07111f',
  },
  center: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },

  loginContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
  },

  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    color: '#0f172a',
  },
  permissionText: {
    fontSize: 15,
    textAlign: 'center',
    color: '#475569',
    marginBottom: 18,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#07111f',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0ea5e9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText: {
    color: 'white',
    fontWeight: '800',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#cbd5e1',
    marginTop: 4,
  },
  camera: {
    height: 220,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  panel: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'white',
  },
  secondaryButtonText: {
    color: '#0284c7',
    fontWeight: '800',
  },
  deviceText: {
    color: '#334155',
    marginBottom: 4,
    fontWeight: '600',
  },
  metaText: {
    color: '#334155',
    marginBottom: 5,
  },
  resultBox: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 28,
    backgroundColor: '#e2e8f0',
  },
  resultText: {
    fontWeight: '800',
    color: '#0f172a',
  },
  acceptedBox: {
    backgroundColor: '#bbf7d0',
  },
  rejectedBox: {
    backgroundColor: '#fecaca',
  },
  alreadyUsedBox: {
  backgroundColor: '#fde68a',
},
fieldLabel: {
  fontSize: 14,
  fontWeight: '800',
  color: '#334155',
  marginBottom: 8,
},
inlineLoading: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 10,
},
concertList: {
  gap: 10,
  marginBottom: 10,
},
concertOption: {
  borderWidth: 1,
  borderColor: '#cbd5e1',
  borderRadius: 12,
  padding: 12,
  backgroundColor: '#f8fafc',
},
concertOptionSelected: {
  borderColor: '#0ea5e9',
  backgroundColor: '#e0f2fe',
},
concertName: {
  fontSize: 15,
  fontWeight: '900',
  color: '#0f172a',
  marginBottom: 4,
},
concertMeta: {
  color: '#475569',
  fontSize: 13,
  marginTop: 2,
},
selectedText: {
  color: '#0369a1',
  fontWeight: '800',
  marginBottom: 10,
},
bottomNav: {
  flexDirection: 'row',
  backgroundColor: 'white',
  borderTopWidth: 1,
  borderTopColor: '#e2e8f0',
  paddingVertical: 8,
  paddingHorizontal: 8,
},
navItem: {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 12,
  alignItems: 'center',
},
navItemActive: {
  backgroundColor: '#e0f2fe',
},
navText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#64748b',
},
navTextActive: {
  color: '#0284c7',
},

heroCard: {
  backgroundColor: '#0f172a',
  borderRadius: 20,
  padding: 18,
  marginBottom: 14,
},
heroLabel: {
  color: '#93c5fd',
  fontWeight: '800',
  marginBottom: 6,
},
heroTitle: {
  color: 'white',
  fontSize: 22,
  fontWeight: '900',
  marginBottom: 6,
},
heroMeta: {
  color: '#cbd5e1',
  marginBottom: 10,
},
statusBadge: {
  alignSelf: 'flex-start',
  backgroundColor: '#fef3c7',
  color: '#92400e',
  fontWeight: '900',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
  marginBottom: 14,
},
primaryAction: {
  backgroundColor: '#0ea5e9',
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: 'center',
},
primaryActionText: {
  color: 'white',
  fontWeight: '900',
  fontSize: 16,
},
scanCamera: {
  height: 420,
  borderRadius: 18,
  overflow: 'hidden',
  backgroundColor: '#111827',
  marginTop: 12,
},

cooldownText: {
  marginTop: 10,
  color: '#92400e',
  fontWeight: '800',
  textAlign: 'center',
},

});
