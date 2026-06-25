// src/screens/CheckInScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, ActivityIndicator, useColorScheme } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { checkNetworkStatus } from '../services/network';
import { getDatabase } from '../db/database';
import { syncLogs, getDeviceId } from '../services/syncService';
import { Colors } from '../constants/theme';

export default function CheckInScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<string>('');

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  // Request permissions and monitor connectivity
  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');

      const online = await checkNetworkStatus();
      setIsOnline(!!online);
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: any) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);
    const qrToken = data.trim();

    setScanResult(`Đang kiểm tra QR: ${qrToken}`);

    try {
      const db = getDatabase();
      const clientEventId = `offline-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const deviceId = await getDeviceId();

      // Perform checking inside a local transaction to block double scans immediately
      await db.withTransactionAsync(async () => {
        // Look up ticket in local SQLite
        const ticket = (await db.getFirstAsync(
          'SELECT ticket_id, qr_token, ticket_type, concert_id, status FROM local_tickets WHERE qr_token = ? LIMIT 1',
          [qrToken]
        )) as {
          ticket_id: string;
          qr_token: string;
          ticket_type: string | null;
          concert_id: string | null;
          status: string;
        } | null;

        if (!ticket) {
          // Ticket not found locally. Log as REJECTED and save fake ticket to pass constraint
          await db.runAsync(
            `INSERT OR IGNORE INTO local_tickets (ticket_id, qr_token, status) VALUES (?, ?, 'INVALID')`,
            [qrToken, qrToken]
          );

          await db.runAsync(
            `INSERT INTO checkin_logs (ticket_id, device_id, client_event_id, status, error_message, sync_mode)
             VALUES (?, ?, ?, 'REJECTED', 'Vé không tồn tại trên thiết bị (Offline)', 'OFFLINE')`,
            [qrToken, deviceId, clientEventId]
          );

          Alert.alert(
            "❌ Check-in Thất bại", 
            `Mã QR: ${qrToken}\n\nLỗi: Vé không tồn tại trên thiết bị.`
          );
          setScanResult(`❌ Thất bại: Vé không tồn tại (${qrToken})`);
        } else if (ticket.status === 'USED') {
          // Duplicate local scan on this device
          await db.runAsync(
            `INSERT INTO checkin_logs (ticket_id, device_id, client_event_id, status, conflict_reason, sync_mode)
             VALUES (?, ?, ?, 'CONFLICT', 'Duplicate local scan', 'OFFLINE')`,
            [ticket.ticket_id, deviceId, clientEventId]
          );

          Alert.alert(
            "⚠️ Trùng quét (Local)", 
            `Mã QR: ${qrToken}\n\nVé này đã được quét và chấp nhận trước đó.`
          );
          setScanResult(`⚠️ Trùng quét: ${qrToken}`);
        } else if (ticket.status !== 'VALID') {
          // Any other status (e.g. INVALID)
          await db.runAsync(
            `INSERT INTO checkin_logs (ticket_id, device_id, client_event_id, status, error_message, sync_mode)
             VALUES (?, ?, ?, 'REJECTED', ?, 'OFFLINE')`,
            [ticket.ticket_id, deviceId, clientEventId, `Vé không hợp lệ (Trạng thái: ${ticket.status})`]
          );

          Alert.alert(
            "❌ Check-in Thất bại", 
            `Mã QR: ${qrToken}\n\nLỗi: Trạng thái vé không hợp lệ (${ticket.status})`
          );
          setScanResult(`❌ Thất bại: Vé không hợp lệ (${qrToken})`);
        } else {
          // VALID ticket! Update status locally and save SUCCESS log
          await db.runAsync(
            `UPDATE local_tickets SET status = 'USED' WHERE ticket_id = ?`,
            [ticket.ticket_id]
          );

          await db.runAsync(
            `INSERT INTO checkin_logs (ticket_id, device_id, client_event_id, status, sync_mode)
             VALUES (?, ?, ?, 'SUCCESS', 'OFFLINE')`,
            [ticket.ticket_id, deviceId, clientEventId]
          );

          Alert.alert(
            "✅ Check-in Thành công", 
            `Loại vé: ${ticket.ticket_type || 'N/A'}\nConcert: ${ticket.concert_id || 'N/A'}\nThời gian: ${new Date().toLocaleTimeString()}`
          );
          setScanResult(`✅ Thành công: ${qrToken}`);
        }
      });

      // Update online status indicator and trigger sync
      const online = await checkNetworkStatus();
      setIsOnline(!!online);
      if (online) {
        // Sync asynchronously
        syncLogs().catch(err => console.error('Auto sync error:', err));
      }

    } catch (error) {
      console.error('Scan processing error:', error);
      Alert.alert("❌ Lỗi", "Lỗi xử lý cơ sở dữ liệu trên thiết bị.");
      setScanResult('❌ Lỗi xử lý cơ sở dữ liệu');
    } finally {
      setIsProcessing(false);
      // Wait before scanning next barcode
      setTimeout(() => setScanned(false), 1500);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Đang yêu cầu quyền truy cập camera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, marginBottom: 10 }}>Không có quyền truy cập camera.</Text>
        <Button title="Thử lại" onPress={() => BarCodeScanner.requestPermissionsAsync()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>🎟️ TicketBox Check-in</Text>
      
      <Text style={[styles.status, { color: isOnline ? '#4CD964' : '#FF9500' }]}>
        {isOnline ? '🟢 Đang Online' : '📴 Đang Offline'}
      </Text>

      <View style={[styles.scannerWrapper, { borderColor: isDark ? '#2E3135' : '#007AFF' }]}>
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={styles.scanner}
        />
      </View>

      {isProcessing && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />}

      {scanResult ? (
        <Text style={[styles.result, { color: colors.text }]}>{scanResult}</Text>
      ) : null}

      <Button 
        title="Quét lại" 
        onPress={() => {
          setScanned(false);
          setScanResult('');
        }} 
        disabled={scanned || isProcessing}
      />

      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Hướng camera vào mã QR trên vé khán giả
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  status: {
    fontSize: 18,
    marginBottom: 20,
    fontWeight: '600',
  },
  scannerWrapper: {
    width: 320,
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 4,
    marginBottom: 30,
  },
  scanner: {
    flex: 1,
  },
  result: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
  },
  note: {
    marginTop: 30,
    fontSize: 14,
    textAlign: 'center',
  },
});