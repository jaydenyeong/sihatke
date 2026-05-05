import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import { STATUS_META } from '@/lib/status';
import type { CircleMember } from '@/lib/types';

const ORDER_KEY = 'watching_order';
const STATUS_PRIORITY = ['need_help', 'not_great', 'okay', 'great'];

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

async function loadSavedOrder(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function persistOrder(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

function applyOrder(members: CircleMember[], order: string[]): CircleMember[] {
  if (order.length === 0) return members;
  const map = new Map(members.map((m) => [m._id, m]));
  const sorted: CircleMember[] = [];
  for (const id of order) {
    if (map.has(id)) sorted.push(map.get(id)!);
  }
  // Append members not yet in saved order (newly added senders)
  for (const m of members) {
    if (!order.includes(m._id)) sorted.push(m);
  }
  return sorted;
}

interface Props {
  editing: boolean;
}

export function WatchingList({ editing }: Props) {
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, savedOrder] = await Promise.all([
        apiRequest<CircleMember[]>('/circle'),
        loadSavedOrder(),
      ]);
      setMembers(applyOrder(res, savedOrder));
    } catch {
      // Silent — auth guard handles 401s
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

  const move = useCallback(async (index: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    if (toIndex < 0 || toIndex >= members.length) return;
    const next = [...members];
    [next[index], next[toIndex]] = [next[toIndex], next[index]];
    const newOrder = next.map((m) => m._id);
    setMembers(next);
    await persistOrder(newOrder);
  }, [members]);

  if (loaded && members.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyEmoji}>🤝</Text>
        <Text style={styles.emptyTitle}>Your circle is empty</Text>
        <Text style={styles.emptySubtext}>
          When someone adds you as a contact using your Sihaty email, they'll appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={members}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
      renderItem={({ item, index }) => {
        const checkin = item.latestCheckin;
        const todayCheckin = checkin && isToday(checkin.createdAt) ? checkin : null;
        const worst = todayCheckin
          ? (STATUS_PRIORITY.find(
              (s) => s === todayCheckin.physicalStatus || s === todayCheckin.mentalStatus
            ) as typeof todayCheckin.physicalStatus)
          : null;

        const initials = item.fullName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.memberName}>{item.fullName}</Text>
              {todayCheckin && worst ? (
                <>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_META[todayCheckin.physicalStatus].bgColor }]}>
                      <Text style={styles.statusPillEmoji}>{STATUS_META[todayCheckin.physicalStatus].emoji}</Text>
                      <Text style={[styles.statusPillText, { color: STATUS_META[todayCheckin.physicalStatus].color }]}>Body</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_META[todayCheckin.mentalStatus].bgColor }]}>
                      <Text style={styles.statusPillEmoji}>{STATUS_META[todayCheckin.mentalStatus].emoji}</Text>
                      <Text style={[styles.statusPillText, { color: STATUS_META[todayCheckin.mentalStatus].color }]}>Mind</Text>
                    </View>
                  </View>
                  <Text style={styles.checkinTime}>Checked in {relativeTime(todayCheckin.createdAt)}</Text>
                </>
              ) : (
                <Text style={styles.noCheckin}>No check-in today</Text>
              )}
            </View>
            {editing ? (
              <View style={styles.arrowBtns}>
                <Pressable
                  style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                  disabled={index === 0}
                  onPress={() => move(index, 'up')}
                  hitSlop={6}>
                  <FontAwesome
                    name="chevron-up"
                    size={13}
                    color={index === 0 ? '#D1D5DB' : theme.textPrimary}
                  />
                </Pressable>
                <Pressable
                  style={[styles.arrowBtn, index === members.length - 1 && styles.arrowBtnDisabled]}
                  disabled={index === members.length - 1}
                  onPress={() => move(index, 'down')}
                  hitSlop={6}>
                  <FontAwesome
                    name="chevron-down"
                    size={13}
                    color={index === members.length - 1 ? '#D1D5DB' : theme.textPrimary}
                  />
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.trafficLight,
                  { backgroundColor: worst ? STATUS_META[worst].bgColor : '#E5E7EB' },
                ]}>
                <Text style={styles.trafficLightEmoji}>
                  {worst ? STATUS_META[worst].emoji : '💤'}
                </Text>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: theme.primary },
  cardBody: { flex: 1, gap: 6 },
  memberName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  statusRow: { flexDirection: 'row', gap: 6 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusPillEmoji: { fontSize: 14 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  checkinTime: { fontSize: 13, color: theme.textSecondary },
  noCheckin: { fontSize: 14, color: theme.textSecondary, fontStyle: 'italic' },
  trafficLight: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trafficLightEmoji: { fontSize: 22 },
  arrowBtns: { gap: 4 },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: { backgroundColor: '#F9FAFB' },
  emptyCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingBottom: 100,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptySubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
