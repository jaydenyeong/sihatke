import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '@/constants/Colors';
import { apiRequest, ApiError } from '@/lib/api';

const TIME_OPTIONS = [
  '06:00', '07:00', '08:00', '09:00', '10:00',
  '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
];

const DEFAULT_TIMES_BY_FREQ: Record<number, string[]> = {
  1: ['09:00'],
  2: ['09:00', '18:00'],
  3: ['08:00', '13:00', '19:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  5: ['07:00', '10:00', '13:00', '16:00', '19:00'],
};

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const [frequency, setFrequency] = useState(1);
  const [times, setTimes] = useState<string[]>(['09:00']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const timezone = useMemo(deviceTimezone, []);

  const setFreq = (n: number) => {
    setFrequency(n);
    setTimes(DEFAULT_TIMES_BY_FREQ[n]);
  };

  const toggleTime = (time: string) => {
    setError('');
    if (times.includes(time)) {
      if (times.length > 1) {
        setTimes(times.filter((t) => t !== time));
      }
    } else if (times.length < frequency) {
      setTimes([...times, time].sort());
    } else {
      setError(`You can pick ${frequency} time${frequency > 1 ? 's' : ''}`);
    }
  };

  const handleSave = async () => {
    if (times.length !== frequency) {
      setError(`Please pick ${frequency} time${frequency > 1 ? 's' : ''}`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiRequest('/profile', {
        method: 'PUT',
        body: {
          checkinFrequency: frequency,
          checkinTimes: times,
          timezone,
        },
      });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <FontAwesome name="heartbeat" size={48} color={theme.primary} />
          <Text style={styles.title}>Set Up Your Check-Ins</Text>
          <Text style={styles.subtitle}>
            We'll remind you to check in each day
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How many times per day?</Text>
          <View style={styles.freqRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = frequency === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setFreq(n)}
                  style={[styles.freqButton, active && styles.freqButtonActive]}>
                  <Text
                    style={[
                      styles.freqButtonText,
                      active && styles.freqButtonTextActive,
                    ]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pick {frequency} time{frequency > 1 ? 's' : ''}
          </Text>
          <Text style={styles.helper}>
            Selected: {times.length}/{frequency}
          </Text>
          <View style={styles.timeGrid}>
            {TIME_OPTIONS.map((time) => {
              const active = times.includes(time);
              return (
                <Pressable
                  key={time}
                  onPress={() => toggleTime(time)}
                  style={[styles.timeChip, active && styles.timeChipActive]}>
                  <Text
                    style={[
                      styles.timeChipText,
                      active && styles.timeChipTextActive,
                    ]}>
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
          ]}
          disabled={submitting}
          onPress={handleSave}>
          <Text style={styles.buttonText}>
            {submitting ? 'Saving…' : 'Continue'}
          </Text>
        </Pressable>

        <Text style={styles.tzNote}>Timezone: {timezone}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 14,
  },
  helper: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 12,
  },
  freqButton: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqButtonActive: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primary,
  },
  freqButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  freqButtonTextActive: {
    color: theme.primary,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeChip: {
    minWidth: 84,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primary,
  },
  timeChipText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  timeChipTextActive: {
    color: theme.primary,
  },
  error: {
    color: theme.danger,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  tzNote: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 18,
  },
});
