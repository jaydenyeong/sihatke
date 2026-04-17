import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '@/constants/Colors';
import { clearToken } from '@/lib/auth';
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

interface Profile {
  _id: string;
  fullName: string;
  email: string;
  checkinFrequency: number;
  checkinTimes: string[];
  timezone: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState(1);
  const [times, setTimes] = useState<string[]>(['09:00']);
  const [timezone, setTimezone] = useState('UTC');

  const loadProfile = useCallback(async () => {
    try {
      const profile = await apiRequest<Profile>('/profile');
      setFullName(profile.fullName ?? '');
      setEmail(profile.email ?? '');
      setFrequency(profile.checkinFrequency ?? 1);
      setTimes(profile.checkinTimes ?? ['09:00']);
      setTimezone(profile.timezone ?? 'UTC');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const setFreq = (n: number) => {
    setFrequency(n);
    setTimes(DEFAULT_TIMES_BY_FREQ[n]);
    setSuccess('');
    setError('');
  };

  const toggleTime = (time: string) => {
    setError('');
    setSuccess('');
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
    if (!fullName.trim()) {
      setError('Name cannot be empty');
      return;
    }
    if (times.length !== frequency) {
      setError(`Please pick ${frequency} time${frequency > 1 ? 's' : ''}`);
      return;
    }
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await apiRequest('/profile', {
        method: 'PUT',
        body: {
          fullName: fullName.trim(),
          checkinFrequency: frequency,
          checkinTimes: times,
          timezone,
        },
      });
      setSuccess('Saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          router.replace('/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (error && !email) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.error}>{error}</Text>
        <Pressable
          onPress={() => {
            setError('');
            setLoading(true);
            loadProfile();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, { marginTop: 16, paddingHorizontal: 40 }]}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }, { marginTop: 16 }]}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              setSuccess('');
            }}
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Full name"
          />
          <Text style={styles.label}>Email</Text>
          <Text style={styles.readOnly}>{email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Check-ins per day</Text>
          <View style={styles.freqRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = frequency === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setFreq(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} check-ins per day`}
                  accessibilityState={{ selected: active }}
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
            Times ({times.length}/{frequency})
          </Text>
          <View style={styles.timeGrid}>
            {TIME_OPTIONS.map((time) => {
              const active = times.includes(time);
              return (
                <Pressable
                  key={time}
                  onPress={() => toggleTime(time)}
                  accessibilityRole="button"
                  accessibilityLabel={`${time} ${active ? 'selected' : 'not selected'}`}
                  accessibilityState={{ selected: active }}
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

        <Text style={styles.tzNote}>Timezone: {timezone}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (pressed || saving) && styles.buttonPressed,
          ]}
          disabled={saving}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save changes">
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }]}>
          <FontAwesome name="sign-out" size={18} color={theme.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 20,
  },
  section: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: theme.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    color: theme.textPrimary,
  },
  readOnly: {
    fontSize: 17,
    color: theme.textPrimary,
    paddingVertical: 10,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 10,
  },
  freqButton: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    backgroundColor: theme.background,
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
    fontSize: 20,
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
    minWidth: 80,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.background,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primary,
  },
  timeChipText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  timeChipTextActive: {
    color: theme.primary,
  },
  tzNote: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  error: {
    color: theme.danger,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 10,
  },
  success: {
    color: theme.primary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  button: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 17,
    color: theme.danger,
    fontWeight: '600',
  },
});
