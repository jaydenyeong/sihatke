import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '@/constants/Colors';
import { STATUS_META } from '@/lib/status';
import type { Checkin } from '@/lib/types';

interface CheckinCardProps {
  todaysCheckin: Checkin | null;
  checkinTimes: string[];
  onStartCheckin: () => void;
}

/** First "HH:MM" in the schedule strictly after the current device time, or null. */
function nextReminder(times: string[]): string | null {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return [...times].sort().find((t) => t > hhmm) ?? null;
}

function Tick() {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, reduceMotion: ReduceMotion.System });
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[styles.tickCircle, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <FontAwesome name="check" size={28} color="#FFFFFF" />
    </Animated.View>
  );
}

export function CheckinCard({ todaysCheckin, checkinTimes, onStartCheckin }: CheckinCardProps) {
  if (!todaysCheckin) {
    return (
      <View style={styles.card}>
        <FontAwesome name="heartbeat" size={44} color={theme.primary} />
        <Text style={styles.title}>How are you feeling?</Text>
        <Text style={styles.subtext}>
          It only takes a few seconds to let your loved ones know.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Start check-in"
          onPress={onStartCheckin}>
          <Text style={styles.ctaButtonText}>Start Check-In</Text>
        </Pressable>
      </View>
    );
  }

  const reminder = nextReminder(checkinTimes);
  const time = new Date(todaysCheckin.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Animated.View
      style={styles.card}
      entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)}>
      <Tick />
      <Text style={styles.title}>You've checked in today</Text>
      <Animated.View
        key={todaysCheckin._id}
        entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)}
        style={styles.statusWrap}>
        <View style={styles.statusRow}>
          {([todaysCheckin.physicalStatus, todaysCheckin.mentalStatus] as const).map((s, i) => (
            <View key={i} style={[styles.statusBadge, { backgroundColor: STATUS_META[s].bgColor }]}>
              <Text style={styles.statusBadgeEmoji}>{STATUS_META[s].emoji}</Text>
              <Text style={[styles.statusBadgeText, { color: STATUS_META[s].color }]}>
                {STATUS_META[s].short}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.timeText}>at {time}</Text>
      </Animated.View>
      {checkinTimes.length > 0 && (
        <Text style={styles.reminderText}>
          {reminder ? `Next reminder: ${reminder}` : 'See you tomorrow 🌙'}
        </Text>
      )}
      <Pressable
        style={({ pressed }) => [styles.againButton, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Check in again"
        onPress={onStartCheckin}>
        <Text style={styles.againButtonText}>Check in again</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    ...theme.cardShadow,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtext: {
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
  tickCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusWrap: {
    alignItems: 'center',
    marginBottom: 4,
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
  timeText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 8,
  },
  reminderText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  againButton: {
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    minHeight: 56,
  },
  againButtonText: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: '700',
  },
});
