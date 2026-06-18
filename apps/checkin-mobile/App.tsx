import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>TicketBox</Text>
        </View>
        <Text style={styles.title}>Check-in Mobile</Text>
        <Text style={styles.subtitle}>
          Ứng dụng Expo cho quét vé và xác thực check-in tại cổng.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
  },
  badge: {
    marginBottom: 16,
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
});
