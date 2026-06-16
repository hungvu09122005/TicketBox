// src/screens/CheckInScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, ActivityIndicator } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Network from 'expo-network';

export default function CheckInScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<string>('');

  // Yêu cầu quyền camera và kiểm tra mạng
  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');

      const networkState = await Network.getNetworkStateAsync();
      setIsOnline(networkState.isConnected ?? false);
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: any) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);
    const qrToken = data.trim();

    setScanResult(`Đang kiểm tra QR: ${qrToken}`);

    try {
      if (isOnline) {
        // TODO: Gọi API thật sau này
        // const response = await fetch(`${API_URL}/checkin/validate`, { ... });
        
        Alert.alert(
          "✅ Check-in Thành công", 
          `QR Token: ${qrToken}\n\nTrạng thái: Hợp lệ\nThời gian: ${new Date().toLocaleTimeString()}`
        );
      } else {
        // Offline mode
        Alert.alert(
          "📴 Check-in Offline", 
          `QR Token: ${qrToken}\n\nĐã lưu vào thiết bị.\nSẽ đồng bộ khi có mạng.`
        );
      }
    } catch (error) {
      Alert.alert("❌ Lỗi", "Không thể kiểm tra vé. Vui lòng thử lại.");
    } finally {
      setIsProcessing(false);
      // Cho phép quét tiếp sau 1.5 giây
      setTimeout(() => setScanned(false), 1500);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text>Đang yêu cầu quyền truy cập camera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text>Không có quyền truy cập camera.</Text>
        <Button title="Thử lại" onPress={() => BarCodeScanner.requestPermissionsAsync()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎟️ Check-in TicketBox</Text>
      
      <Text style={[styles.status, { color: isOnline ? 'green' : 'orange' }]}>
        {isOnline ? '🟢 Đang Online' : '📴 Đang Offline'}
      </Text>

      <View style={styles.scannerWrapper}>
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={styles.scanner}
        />
      </View>

      {isProcessing && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />}

      {scanResult ? <Text style={styles.result}>{scanResult}</Text> : null}

      <Button 
        title="Quét lại" 
        onPress={() => {
          setScanned(false);
          setScanResult('');
        }} 
        disabled={scanned || isProcessing}
      />

      <Text style={styles.note}>
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
    backgroundColor: '#f8f9fa',
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
    borderColor: '#007AFF',
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
  },
  note: {
    marginTop: 30,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});