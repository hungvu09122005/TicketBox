import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BarcodeScanningResult,
  CameraView as ExpoCameraView,
  useCameraPermissions,
} from 'expo-camera';
import * as Crypto from 'expo-crypto';

const API_BASE_URL = 'http://192.168.100.60:3001/api/v1';
const DEVICE_ID = 'TEMP_DEVICE_ID';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState('');
  const CameraView = ExpoCameraView as any;

  const validateQrToken = async (qrToken: string) => {
    if (!qrToken.trim()) {
      setMessage('Vui lòng nhập mã vé.');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const response = await fetch(`${API_BASE_URL}/checkin/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',

          // Sau này login xong thì thay token thật vào đây
          // Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          qr_token: qrToken.trim(),
          client_event_id: Crypto.randomUUID(),
          device_id: DEVICE_ID,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Check-in thất bại.');
      }

      setMessage('Check-in thành công.');
    } catch (error: any) {
      setMessage(error?.message || 'Check-in thất bại.');
    } finally {
      setLoading(false);
      setTimeout(() => setScanned(false), 1200);
    }
  };

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (loading || scanned) return;

    setScanned(true);
    await validateQrToken(result.data);
  };

  const handleManualSubmit = async () => {
    await validateQrToken(manualCode);
    setManualCode('');
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator />
          <Text>Đang kiểm tra camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>TicketBox</Text>
          </View>

          <Text style={styles.title}>Check-in Mobile</Text>

          <Text style={styles.subtitle}>
            Ứng dụng cần quyền camera để quét QR vé tại cổng.
          </Text>

          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Cấp quyền camera</Text>
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

        <Text style={styles.headerTitle}>Check-in Mobile</Text>
        <Text style={styles.headerSubtitle}>
          Quét QR thật hoặc nhập mã thủ công.
        </Text>
      </View>

      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Nhập mã thủ công</Text>

        <TextInput
          style={styles.input}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Dán hoặc nhập qr_token"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleManualSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Đang kiểm tra...' : 'Xác nhận check-in'}
          </Text>
        </Pressable>

        {!!message && <Text style={styles.message}>{message}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#0f172a',
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 4,
    color: '#cbd5e1',
    fontSize: 14,
  },
  camera: {
    flex: 1,
    backgroundColor: '#020617',
  },
  panel: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    marginTop: 12,
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'center',
  },
});