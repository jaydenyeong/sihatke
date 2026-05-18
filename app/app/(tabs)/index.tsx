import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import { STATUS_META } from '@/lib/status';
import type { Checkin } from '@/lib/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getDateString(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface Me {
  fullName: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const greeting = getGreeting();
  const dateString = getDateString();

  const [userName, setUserName] = useState('');
  const [latest, setLatest] = useState<Checkin | null>(null);
  const [streak, setStreak] = useState(0);
  const [weekDots, setWeekDots] = useState<boolean[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [me, last, stats] = await Promise.all([
            apiRequest<Me>('/auth/me'),
            apiRequest<Checkin | null>('/checkins/latest'),
            apiRequest<{ currentStreak: number; weekDots: boolean[] }>('/checkins/stats'),
          ]);
          if (cancelled) return;
          setUserName(me.fullName || '');
          setLatest(last);
          setStreak(stats.currentStreak);
          setWeekDots(stats.weekDots);
        } catch {
          // Silent — auth guard handles 401s; other errors leave stale state.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const todaysCheckin = latest && isToday(latest.createdAt) ? latest : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Green hero header */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>

            <View>
              <Text style={styles.dateText}>{dateString}</Text>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.name}>{userName || 'Friend'} 👋</Text>
            </View>
            <View style={styles.avatarCircle}>
              <FontAwesome name="user" size={28} color={theme.primary} />
            </View>
          </View>

          {/* Week dots + streak */}
          {weekDots.length === 7 && (
            <View style={styles.consistencyRow}>
              <View style={styles.dotsRow}>
                {weekDots.map((filled, i) => (
                  <View
                    key={i}
                    style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
                  />
                ))}
              </View>
              {streak > 0 && (
                <Text style={styles.streakText}>🔥 {streak} day{streak !== 1 ? 's' : ''}</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.body}>
          {todaysCheckin ? (
            <View style={styles.statusCard}>
              <Text style={styles.cardLabel}>Today's last check-in</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_META[todaysCheckin.physicalStatus].bgColor }]}>
                  <Text style={styles.statusBadgeEmoji}>{STATUS_META[todaysCheckin.physicalStatus].emoji}</Text>
                  <Text style={[styles.statusBadgeText, { color: STATUS_META[todaysCheckin.physicalStatus].color }]}>
                    {STATUS_META[todaysCheckin.physicalStatus].short}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_META[todaysCheckin.mentalStatus].bgColor }]}>
                  <Text style={styles.statusBadgeEmoji}>{STATUS_META[todaysCheckin.mentalStatus].emoji}</Text>
                  <Text style={[styles.statusBadgeText, { color: STATUS_META[todaysCheckin.mentalStatus].color }]}>
                    {STATUS_META[todaysCheckin.mentalStatus].short}
                  </Text>
                </View>
              </View>
              <Text style={styles.checkinTime}>
                {new Date(todaysCheckin.createdAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ) : (
            <View style={styles.statusCard}>
              <Text style={styles.cardLabel}>No check-ins yet today</Text>
              <Text style={styles.cardSubtext}>Tap below to share how you're feeling</Text>
            </View>
          )}

          <View style={styles.ctaCard}>
            <FontAwesome name="heartbeat" size={44} color={theme.primary} />
            <Text style={styles.ctaTitle}>How are you feeling?</Text>
            <Text style={styles.ctaSubtext}>
              It only takes a few seconds to let your loved ones know.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Start check-in"
              onPress={() => router.push('/checkin')}>
              <Text style={styles.ctaButtonText}>Start Check-In</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  hero: {
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  consistencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotFilled: {
    backgroundColor: '#FFFFFF',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    marginTop: -12,
  },
  statusCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...theme.cardShadow,
  },
  cardLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardSubtext: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  statusBadgeEmoji: {
    fontSize: 20,
  },
  statusBadgeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  checkinTime: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 8,
  },
  nudgeCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
  },
  nudgeBody: {
    flex: 1,
  },
  nudgeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  nudgeSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  ctaCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    ...theme.cardShadow,
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },
  ctaSubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 23,
  },
  ctaButton: {
    backgroundColor: theme.cta,
    borderRadius: 16,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
  },
  ctaButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
});
