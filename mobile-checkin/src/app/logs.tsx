// src/app/logs.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useColorScheme,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, MaxContentWidth } from '@/constants/theme';
import { getDatabase } from '@/db/database';
import { syncLogs, addSyncListener } from '@/services/syncService';

type LogItem = {
  id: number;
  ticket_id: string;
  qr_token: string | null;
  scanned_at: string;
  status: string;
  is_synced: number;
  sync_mode: string;
  error_message: string | null;
  conflict_reason: string | null;
};

export default function LogsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'CONFLICT' | 'REJECTED'>('ALL');
  const [syncState, setSyncState] = useState({ isSyncing: false, error: null as string | null });
  const [refreshing, setRefreshing] = useState(false);

  // Load logs from SQLite
  const loadLogs = async () => {
    try {
      const db = getDatabase();
      const loadedLogs = (await db.getAllAsync(`
        SELECT cl.*, lt.qr_token 
        FROM checkin_logs cl
        LEFT JOIN local_tickets lt ON cl.ticket_id = lt.ticket_id
        ORDER BY cl.scanned_at DESC
      `)) as LogItem[];
      setLogs(loadedLogs);
    } catch (e) {
      console.error('Failed to load checkin logs:', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.resolve();
      loadLogs();
    };
    init();
    
    // Subscribe to sync state changes
    const removeListener = addSyncListener((state: any) => {
      setSyncState(state);
      loadLogs(); // Reload logs whenever sync finishes/updates
    });

    return () => {
      removeListener();
    };
  }, []);

  const handleManualSync = async () => {
    await syncLogs();
    await loadLogs();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.status === filter;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return '#4CD964'; // Green
      case 'CONFLICT':
        return '#FFCC00'; // Orange
      case 'REJECTED':
        return '#FF3B30'; // Red
      default:
        return '#8E8E93';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'SUCCESS';
      case 'CONFLICT':
        return 'CONFLICT';
      case 'REJECTED':
        return 'REJECTED';
      default:
        return status;
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header bar */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <ThemedText type="subtitle">Check-in Logs</ThemedText>
        
        {/* Sync state message */}
        {syncState.isSyncing ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: Spacing.one }} />
            <ThemedText type="small" themeColor="textSecondary">Synchronizing...</ThemedText>
          </View>
        ) : syncState.error ? (
          <ThemedText type="small" style={{ color: '#FF3B30' }}>
            Sync error: {syncState.error}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            All offline records synchronized
          </ThemedText>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(['ALL', 'SUCCESS', 'CONFLICT', 'REJECTED'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setFilter(t)}
            style={[
              styles.filterTab,
              filter === t && { backgroundColor: colors.backgroundSelected },
            ]}>
            <ThemedText
              type={filter === t ? 'smallBold' : 'small'}
              themeColor={filter === t ? 'text' : 'textSecondary'}>
              {t}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Logs List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyView}>
            <ThemedText type="default" themeColor="textSecondary">
              No scan logs found.
            </ThemedText>
          </View>
        ) : (
          filteredLogs.map((log) => (
            <View
              key={log.id}
              style={[styles.logCard, { backgroundColor: colors.backgroundElement }]}>
              {/* Card Header */}
              <View style={styles.logCardHeader}>
                <ThemedText type="smallBold" style={styles.qrText}>
                  🎟️ {log.qr_token || log.ticket_id}
                </ThemedText>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusBadgeColor(log.status) },
                  ]}>
                  <ThemedText type="code" style={styles.badgeText}>
                    {getStatusLabel(log.status)}
                  </ThemedText>
                </View>
              </View>

              {/* Card Body */}
              <View style={styles.logCardBody}>
                <View style={styles.infoRow}>
                  <ThemedText type="code" style={styles.infoLabel}>Time:</ThemedText>
                  <ThemedText type="code" themeColor="textSecondary">
                    {new Date(log.scanned_at).toLocaleString()}
                  </ThemedText>
                </View>

                <View style={styles.infoRow}>
                  <ThemedText type="code" style={styles.infoLabel}>Mode:</ThemedText>
                  <ThemedText type="code" themeColor="textSecondary">
                    {log.sync_mode}
                  </ThemedText>
                </View>

                <View style={styles.infoRow}>
                  <ThemedText type="code" style={styles.infoLabel}>Synced:</ThemedText>
                  <ThemedText
                    type="code"
                    style={{ color: log.is_synced ? '#4CD964' : '#FF3B30', fontWeight: 'bold' }}>
                    {log.is_synced ? '✅ YES' : '❌ NO'}
                  </ThemedText>
                </View>

                {/* Display Rejection / Conflict Reasons */}
                {log.status === 'REJECTED' && log.error_message && (
                  <View style={styles.errorContainer}>
                    <ThemedText type="smallBold" style={{ color: '#FF3B30' }}>
                      Rejection Reason:
                    </ThemedText>
                    <ThemedText type="small" themeColor="text">
                      {log.error_message}
                    </ThemedText>
                  </View>
                )}

                {log.status === 'CONFLICT' && log.conflict_reason && (
                  <View style={styles.errorContainer}>
                    <ThemedText type="smallBold" style={{ color: '#FFCC00' }}>
                      Conflict Details:
                    </ThemedText>
                    <ThemedText type="small" themeColor="text">
                      {log.conflict_reason}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Sync Button Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          onPress={handleManualSync}
          disabled={syncState.isSyncing}
          style={({ pressed }) => [
            styles.syncButton,
            { backgroundColor: syncState.isSyncing ? '#8E8E93' : '#007AFF' },
            pressed && { opacity: 0.8 },
          ]}>
          <ThemedText style={styles.syncButtonText}>
            {syncState.isSyncing ? 'Syncing...' : '🔄 Manual Sync Now'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  header: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    alignItems: 'flex-start',
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
    backgroundColor: 'rgba(128,128,128,0.05)',
  },
  filterTab: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  scrollView: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  logCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
    paddingBottom: Spacing.one,
    marginBottom: Spacing.two,
  },
  qrText: {
    flex: 1,
    marginRight: Spacing.two,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
  },
  badgeText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 10,
  },
  logCardBody: {
    gap: Spacing.one,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontWeight: 'bold',
  },
  errorContainer: {
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(128,128,128,0.1)',
    gap: Spacing.half,
  },
  footer: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  syncButton: {
    height: 50,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
