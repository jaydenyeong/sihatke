import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import { STATUS_META } from '@/lib/status';
import type { Alert as AlertItem, AlertType, Checkin } from '@/lib/types';

const ALERT_META: Record<AlertType, { label: string; color: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }> = {
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

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(iso) === dayKey(now.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

interface Section { title: string; data: Checkin[]; }

function groupByDay(items: Checkin[]): Section[] {
  const groups = new Map<string, Section>();
  for (const item of items) {
    const key = dayKey(item.createdAt);
    if (!groups.has(key)) groups.set(key, { title: dayLabel(item.createdAt), data: [] });
    groups.get(key)!.data.push(item);
  }
  return Array.from(groups.values());
}

export default function HistoryScreen() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [checkinRes, alertRes] = await Promise.all([
        apiRequest<{ checkins: Checkin[] }>('/checkins'),
        apiRequest<AlertItem[]>('/alerts'),
      ]);
      setCheckins(checkinRes.checkins);
      setAlerts(alertRes);
    } catch {
      // Silent — 401s handled by auth guard
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const markSeen = async (id: string) => {
    try {
      await apiRequest(`/alerts/${id}`, { method: 'PUT', body: { status: 'seen' } });
      setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, status: 'seen' } : a)));
    } catch { /* Silent */ }
  };

  const sections = useMemo(() => groupByDay(checkins), [checkins]);

  const alertsHeader = (
    <View style={styles.alertsSection}>
      <Text style={styles.sectionHeader}>Alerts 🔔</Text>
      {alerts.length === 0 ? (
        <View style={styles.noAlerts}>
          <Text style={styles.noAlertsText}>All clear — no alerts</Text>
        </View>
      ) : (
        alerts.map((item) => {
          const meta = ALERT_META[item.alertType];
          const isNew = item.status === 'sent';
          return (
            <Pressable
              key={item._id}
              style={[styles.alertCard, !isNew && styles.alertCardSeen]}
              onPress={() => isNew && markSeen(item._id)}>
              <View style={styles.alertTop}>
                <View style={[styles.alertBadge, { backgroundColor: meta.color }]}>
                  <FontAwesome name={meta.icon} size={12} color="#FFF" />
                  <Text style={styles.alertBadgeText}>{meta.label}</Text>
                </View>
                {isNew && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>New</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.alertContact, !isNew && styles.dimmed]}>
                {item.contactId?.name ?? 'Unknown contact'}
                {item.contactId?.relationship ? ` (${item.contactId.relationship})` : ''}
              </Text>
              {item.message ? <Text style={[styles.alertMessage, !isNew && styles.dimmed]}>{item.message}</Text> : null}
              <Text style={styles.alertTime}>{relativeTime(item.createdAt)}</Text>
            </Pressable>
          );
        })
      )}
      <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Your Check-Ins 📋</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loaded && checkins.length === 0 && alerts.length === 0 ? (
        <>
          <Text style={styles.title}>History</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.emptySubtext}>Your check-ins and alerts will appear here</Text>
          </View>
        </>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>History</Text>
              {alertsHeader}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const order = ['need_help', 'not_great', 'okay', 'great'];
            const worst = order.find(
              (s) => s === item.physicalStatus || s === item.mentalStatus
            ) as typeof item.physicalStatus;
            const accent = STATUS_META[worst];
            return (
              <View style={[styles.historyCard, { borderLeftColor: accent.color }]}>
                <View style={styles.historyRow}>
                  <View style={styles.statusGroup}>
                    <View style={styles.emojiRow}>
                      <Text style={styles.statusEmoji}>{STATUS_META[item.physicalStatus].emoji}</Text>
                      <Text style={styles.statusEmoji}>{STATUS_META[item.mentalStatus].emoji}</Text>
                    </View>
                    <Text style={styles.statusLabel}>
                      Body: {STATUS_META[item.physicalStatus].short} · Mind: {STATUS_META[item.mentalStatus].short}
                    </Text>
                  </View>
                  <Text style={styles.historyTime}>
                    {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                {item.note ? <Text style={styles.historyNote}>"{item.note}"</Text> : null}
              </View>
            );
          }}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary, marginTop: 16, marginBottom: 16 },
  list: { paddingBottom: 24 },
  alertsSection: { marginBottom: 4 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
    marginTop: 8,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noAlerts: { paddingVertical: 12 },
  noAlertsText: { fontSize: 14, color: theme.textSecondary, fontStyle: 'italic' },
  alertCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10 },
  alertCardSeen: { opacity: 0.65 },
  alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  alertBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  newBadge: { backgroundColor: theme.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  newBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  alertContact: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  alertMessage: { fontSize: 14, color: theme.textSecondary, marginBottom: 4 },
  alertTime: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  dimmed: { color: theme.textSecondary },
  historyCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, borderLeftWidth: 4 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusGroup: { flex: 1, flexDirection: 'column' },
  emojiRow: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  statusEmoji: { fontSize: 22 },
  statusLabel: { fontSize: 13, color: theme.textSecondary },
  historyTime: { fontSize: 14, color: theme.textSecondary, marginLeft: 12 },
  historyNote: { fontSize: 14, color: theme.textSecondary, fontStyle: 'italic', marginTop: 8 },
  emptyCard: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptySubtext: { fontSize: 16, color: theme.textSecondary },
});
