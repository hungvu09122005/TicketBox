import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { initDatabase } from '@/db/database';
import CheckInScreen from '@/screens/CheckInScreen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setDbReady(true);
      } catch (err) {
        console.error('❌ Init DB Error:', err);
        setError(err instanceof Error ? err.message : 'Database initialization failed');
      }
    };
    init();
  }, []);

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={{ color: 'red' }}>Error: {error}</ThemedText>
      </ThemedView>
    );
  }

  if (!dbReady) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={{ marginTop: 10 }}>Initializing database...</ThemedText>
      </ThemedView>
    );
  }

  return <CheckInScreen />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
