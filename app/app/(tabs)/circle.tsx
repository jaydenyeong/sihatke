import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import { STATUS_META } from '@/lib/status';
import type { CircleMember } from '@/lib/types';

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TrafficLight({ member }: { member: CircleMember }) {
  const checkin = member.latestCheckin;
  const todayCheckin = checkin && isToday(checkin.createdAt) ? checkin : null;

  if (!todayCheckin) {
    return (
      <View style={[styles.trafficLight, { backgroundColor: '#E5E7EB' }]}>
        <Text style={styles.trafficLightEmoji}>💤</Text>
      </View>
    );
  }

  // Worst status of the two
  const order: string[] = ['need_help', 'not_great', 'okay', 'great'];
  const worst = order.find(
    (s) => s === todayCheckin.physicalStatus || s === todayCheckin.mentalStatus
  ) as typeof todayCheckin.physicalStatus;
  const meta = STATUS_META[worst];

  return (
    <View style={[styles.trafficLight, { backgroundColor: meta.bgColor }]}>
      <Text style={styles.trafficLightEmoji}>{meta.emoji}</Text>
    </View>
  );
}

export default function CircleScreen() {
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<CircleMember[]>('/circle');
      setMembers(res);
    } catch {
      // Silent — auth guard handles 401s
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

  const renderMember = ({ item }: { item: CircleMember }) => {
    const checkin = item.latestCheckin;
    const todayCheckin = checkin && isToday(checkin.createdAt) ? checkin : null;

    const initials = item.fullName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.memberName}>{item.fullName}</Text>
          {todayCheckin ? (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.statusPill, { backgroundColor: STATUS_META[todayCheckin.physicalStatus].bgColor }]}>
                  <Text style={styles.statusPillEmoji}>{STATUS_META[todayCheckin.physicalStatus].emoji}</Text>
                  <Text style={[styles.statusPillText, { color: STATUS_META[todayCheckin.physicalStatus].color }]}>
                    Body
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: STATUS_META[todayCheckin.mentalStatus].bgColor }]}>
                  <Text style={styles.statusPillEmoji}>{STATUS_META[todayCheckin.mentalStatus].emoji}</Text>
                  <Text style={[styles.statusPillText, { color: STATUS_META[todayCheckin.mentalStatus].color }]}>
                    Mind
                  </Text>
                </View>
              </View>
              <Text style={styles.checkinTime}>
                Checked in {relativeTime(todayCheckin.createdAt)}
              </Text>
            </>
          ) : (
            <Text style={styles.noCheckin}>No check-in today</Text>
          )}
        </View>

        <TrafficLight member={item} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Circle</Text>
      <Text style={styles.subtitle}>People who share their check-ins with you</Text>

      {loaded && members.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={styles.emptyTitle}>Your circle is empty</Text>
          <Text style={styles.emptySubtext}>
            When someone adds you as a contact using your Sihaty email, they'll appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item._id}
          renderItem={renderMember}
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardLeft: {
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primary,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusPillEmoji: {
    fontSize: 14,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkinTime: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  noCheckin: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  trafficLight: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trafficLightEmoji: {
    fontSize: 22,
  },
  emptyCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
    paddingHorizontal: 20,
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
    textAlign: 'center',
    lineHeight: 22,
  },
});
