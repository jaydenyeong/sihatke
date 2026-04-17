import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import type { Alert as AlertItem, AlertType } from '@/lib/types';

const ALERT_TYPE_META: Record<
  AlertType,
  { label: string; color: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }
> = {
  need_help: { label: 'Needs Help', color: theme.danger, icon: 'exclamation-circle' },
  missed_checkin: { label: 'Missed Check-in', color: theme.warning, icon: 'clock-o' },
  decline_pattern: { label: 'Declining Trend', color: theme.warning, icon: 'arrow-down' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<AlertItem[]>('/alerts');
      setAlerts(res);
    } catch {
      // Silent
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

  const markSeen = async (id: string) => {
    try {
      await apiRequest(`/alerts/${id}`, {
        method: 'PUT',
        body: { status: 'seen' },
      });
      setAlerts((prev) =>
        prev.map((a) => (a._id === id ? { ...a, status: 'seen' } : a))
      );
    } catch {
      // Silent
    }
  };

  const renderAlert = ({ item }: { item: AlertItem }) => {
    const meta = ALERT_TYPE_META[item.alertType];
    const isNew = item.status === 'sent';

    return (
      <Pressable
        style={[styles.card, !isNew && styles.cardSeen]}
        onPress={() => isNew && markSeen(item._id)}>
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, { backgroundColor: meta.color }]}>
            <FontAwesome name={meta.icon} size={12} color="#FFF" />
            <Text style={styles.typeBadgeText}>{meta.label}</Text>
          </View>
          {isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>New</Text>
            </View>
          )}
        </View>

        <Text style={[styles.contactName, !isNew && styles.dimmed]}>
          {item.contactId?.name ?? 'Unknown contact'}
          {item.contactId?.relationship ? ` (${item.contactId.relationship})` : ''}
        </Text>

        {item.message ? (
          <Text style={[styles.message, !isNew && styles.dimmed]}>{item.message}</Text>
        ) : null}

        <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Alerts</Text>

      {loaded && alerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>All clear!</Text>
          <Text style={styles.emptySubtext}>
            Alerts from your contacts will show up here
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item._id}
          renderItem={renderAlert}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
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
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardSeen: {
    opacity: 0.65,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  newBadge: {
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  dimmed: {
    color: theme.textSecondary,
  },
  time: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
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
