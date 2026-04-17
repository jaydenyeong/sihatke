import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/Colors';
import { apiRequest, ApiError } from '@/lib/api';
import { STATUS_META, STATUS_ORDER } from '@/lib/status';
import type { Checkin, StatusLevel } from '@/lib/types';

type Step = 'physical' | 'mental' | 'note' | 'done';

const statusOptions = STATUS_ORDER.map((value) => ({
  value,
  emoji: STATUS_META[value].emoji,
  label: STATUS_META[value].short,
}));

export default function CheckInScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('physical');
  const [physical, setPhysical] = useState<StatusLevel | null>(null);
  const [mental, setMental] = useState<StatusLevel | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handlePhysicalSelect = (status: StatusLevel) => {
    setPhysical(status);
    setStep('mental');
  };

  const handleMentalSelect = (status: StatusLevel) => {
    setMental(status);
    setStep('note');
  };

  const handleSubmit = async () => {
    if (!physical || !mental) return;
    setError('');
    setSubmitting(true);
    try {
      await apiRequest<Checkin>('/checkins', {
        method: 'POST',
        body: {
          physicalStatus: physical,
          mentalStatus: mental,
          note: note.trim() || undefined,
        },
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    setStep('physical');
    setPhysical(null);
    setMental(null);
    setNote('');
    setError('');
    router.replace('/');
  };

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.doneCard}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>Check-in Complete!</Text>
          <Text style={styles.doneSubtext}>
            Your contacts have been updated with your status.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            onPress={handleDone}>
            <Text style={styles.ctaButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.stepIndicator}>
          Step {step === 'physical' ? '1' : step === 'mental' ? '2' : '3'} of 3
        </Text>

        {step === 'physical' && (
          <View style={styles.questionCard}>
            <Text style={styles.questionTitle}>How is your body feeling?</Text>
            <Text style={styles.questionSubtext}>Tap the option that best describes you</Text>
            <View style={styles.optionsGrid}>
              {statusOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Body feels ${opt.label}`}
                  style={({ pressed }) => [
                    styles.optionButton,
                    pressed && styles.optionPressed,
                  ]}
                  onPress={() => handlePhysicalSelect(opt.value)}>
                  <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 'mental' && (
          <View style={styles.questionCard}>
            <Text style={styles.questionTitle}>How is your mind feeling?</Text>
            <Text style={styles.questionSubtext}>Tap the option that best describes you</Text>
            <View style={styles.optionsGrid}>
              {statusOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Mind feels ${opt.label}`}
                  style={({ pressed }) => [
                    styles.optionButton,
                    pressed && styles.optionPressed,
                  ]}
                  onPress={() => handleMentalSelect(opt.value)}>
                  <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 'note' && (
          <View style={styles.questionCard}>
            <Text style={styles.questionTitle}>Anything to add?</Text>
            <Text style={styles.questionSubtext}>Optional — share a short note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Had a lovely walk in the garden..."
              placeholderTextColor={theme.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={200}
              editable={!submitting}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit check-in"
              style={({ pressed }) => [
                styles.ctaButton,
                (pressed || submitting) && styles.ctaButtonPressed,
              ]}
              onPress={handleSubmit}>
              <Text style={styles.ctaButtonText}>
                {submitting ? 'Saving…' : 'Submit Check-In'}
              </Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Skip note and submit"
              style={styles.skipButton}
              onPress={() => {
                setNote('');
                handleSubmit();
              }}>
              <Text style={styles.skipText}>Skip & Submit</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    padding: 20,
  },
  stepIndicator: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  questionCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  questionSubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 28,
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  optionButton: {
    backgroundColor: theme.primaryLight,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '47%',
    minHeight: 100,
    justifyContent: 'center',
  },
  optionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  optionEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  noteInput: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.textPrimary,
    width: '100%',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
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
  error: {
    color: theme.danger,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  skipButton: {
    marginTop: 12,
    padding: 12,
  },
  skipText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  doneCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  doneEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  doneSubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
});
