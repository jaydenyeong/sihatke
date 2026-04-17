import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [me, last] = await Promise.all([
            apiRequest<Me>('/auth/me'),
            apiRequest<Checkin | null>('/checkins/latest'),
          ]);
          if (cancelled) return;
          setUserName(me.fullName || '');
          setLatest(last);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{dateString}</Text>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{userName || 'Friend'} 👋</Text>
        </View>
        <View style={styles.avatar}>
          <FontAwesome name="user-circle" size={56} color={theme.primary} />
        </View>
      </View>

      {todaysCheckin ? (
        <View style={styles.lastCheckinCard}>
          <Text style={styles.lastCheckinLabel}>Today's last check-in</Text>
          <View style={styles.lastCheckinRow}>
            <Text style={styles.lastCheckinStatus}>
              {STATUS_META[todaysCheckin.physicalStatus].emoji}{' '}
              {STATUS_META[todaysCheckin.physicalStatus].label}
            </Text>
            <Text style={styles.lastCheckinTime}>
              {new Date(todaysCheckin.createdAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.lastCheckinCard}>
          <Text style={styles.lastCheckinLabel}>No check-ins yet today</Text>
          <Text style={styles.lastCheckinSubtext}>
            Tap below to do your first check-in
          </Text>
        </View>
      )}

      <View style={styles.ctaCard}>
        <FontAwesome name="heartbeat" size={48} color={theme.primary} />
        <Text style={styles.ctaTitle}>How are you feeling?</Text>
        <Text style={styles.ctaSubtext}>
          Tap below to do your check-in — it only takes a few seconds.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaButtonPressed,
          ]}
          onPress={() => router.push('/checkin')}>
          <Text style={styles.ctaButtonText}>Start Check-In</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 24,
  },
  dateText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.primary,
  },
  avatar: {
    marginTop: 8,
  },
  lastCheckinCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  lastCheckinLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  lastCheckinSubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 4,
  },
  lastCheckinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastCheckinStatus: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  lastCheckinTime: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  ctaCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  ctaSubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  ctaButton: {
    backgroundColor: theme.cta,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
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
