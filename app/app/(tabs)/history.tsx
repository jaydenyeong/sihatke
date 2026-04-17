import { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SectionList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import { STATUS_META } from '@/lib/status';
import type { Checkin } from '@/lib/types';

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = dayKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const k = dayKey(iso);
  if (k === today) return 'Today';
  if (k === dayKey(yesterday.toISOString())) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

interface Section {
  title: string;
  data: Checkin[];
}

function groupByDay(items: Checkin[]): Section[] {
  const groups = new Map<string, { title: string; data: Checkin[] }>();
  for (const item of items) {
    const key = dayKey(item.createdAt);
    if (!groups.has(key)) {
      groups.set(key, { title: dayLabel(item.createdAt), data: [] });
    }
    groups.get(key)!.data.push(item);
  }
  return Array.from(groups.values());
}

export default function HistoryScreen() {
  const [items, setItems] = useState<Checkin[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ checkins: Checkin[] }>('/checkins');
      setItems(res.checkins);
    } catch {
      // Silent — 401s handled by auth guard.
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const sections = useMemo(() => groupByDay(items), [items]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Check-in History</Text>

      {loaded && items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No check-ins yet</Text>
          <Text style={styles.emptySubtext}>
            Your check-in history will appear here
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View style={styles.statusGroup}>
                  <Text style={styles.statusEmoji}>
                    {STATUS_META[item.physicalStatus].emoji}{' '}
                    {STATUS_META[item.mentalStatus].emoji}
                  </Text>
                  <Text style={styles.statusLabel}>
                    Body: {STATUS_META[item.physicalStatus].short} · Mind:{' '}
                    {STATUS_META[item.mentalStatus].short}
                  </Text>
                </View>
                <Text style={styles.historyTime}>
                  {new Date(item.createdAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              {item.note ? <Text style={styles.historyNote}>"{item.note}"</Text> : null}
            </View>
          )}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 20,
  },
  list: {
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textSecondary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusGroup: {
    flex: 1,
    flexDirection: 'column',
  },
  statusEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  historyTime: {
    fontSize: 14,
    color: theme.textSecondary,
    marginLeft: 12,
  },
  historyNote: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  emptyCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: theme.textSecondary,
  },
});
