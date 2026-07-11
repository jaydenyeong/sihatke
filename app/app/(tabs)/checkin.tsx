import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Reanimated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '@/constants/Colors';
import { apiRequest, ApiError } from '@/lib/api';
import { STATUS_META, STATUS_ORDER } from '@/lib/status';
import type { Checkin, StatusLevel } from '@/lib/types';
import { Petal } from '@/components/tree/Petal';

type Step = 'physical' | 'mental' | 'note' | 'done';

const STEP_INDEX: Record<Step, number> = { physical: 0, mental: 1, note: 2, done: 3 };

const statusOptions = STATUS_ORDER.map((value) => ({
  value,
  emoji: STATUS_META[value].emoji,
  label: STATUS_META[value].short,
}));

function useSlideIn(step: Step) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const prevStep = useRef<Step>(step);

  useEffect(() => {
    const forward = STEP_INDEX[step] > STEP_INDEX[prevStep.current];
    prevStep.current = step;

    // Start from off-screen in the appropriate direction
    translateX.setValue(forward ? 60 : -60);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 11,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  return { translateX, opacity };
}

function SuccessTick() {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, reduceMotion: ReduceMotion.System });
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Reanimated.View
      style={[styles.doneTick, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <FontAwesome name="check" size={40} color="#FFFFFF" />
    </Reanimated.View>
  );
}

export default function CheckInScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('physical');
  const [physical, setPhysical] = useState<StatusLevel | null>(null);
  const [mental, setMental] = useState<StatusLevel | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { translateX, opacity } = useSlideIn(step);

  const goBack = () => {
    if (step === 'mental') setStep('physical');
    else if (step === 'note') setStep('mental');
  };

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
          {Array.from({ length: 8 }, (_, i) => (
            <Petal key={i} index={i} left={20 + i * 42} top={40 + (i % 4) * 16} />
          ))}
          <SuccessTick />
          <Text style={styles.doneTitle}>Check-in Complete!</Text>
          <Text style={styles.doneSubtext}>
            Your contacts have been updated with your status.
          </Text>
          <Text style={styles.doneTreeLine}>Your tree just got a little water 🌱</Text>
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

  const currentStepNum = STEP_INDEX[step] + 1;
  const canGoBack = step !== 'physical';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button + progress dots */}
      <View style={styles.header}>
        {canGoBack ? (
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <FontAwesome name="chevron-left" size={18} color={theme.primary} />
          </Pressable>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        <View style={styles.progressDots}>
          {[1, 2, 3].map((n) => (
            <View
              key={n}
              style={[
                styles.progressDot,
                n < currentStepNum && styles.progressDotDone,
                n === currentStepNum && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ transform: [{ translateX }], opacity }}>
          {step === 'physical' && (
            <View style={styles.questionCard}>
              <Text style={styles.stepLabel}>Step 1 of 3</Text>
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
                      { backgroundColor: STATUS_META[opt.value].bgColor, borderColor: STATUS_META[opt.value].color },
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => handlePhysicalSelect(opt.value)}>
                    <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.optionLabel, { color: STATUS_META[opt.value].color }]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 'mental' && (
            <View style={styles.questionCard}>
              <Text style={styles.stepLabel}>Step 2 of 3</Text>
              <Text style={styles.questionTitle}>How is your mind feeling?</Text>
              <Text style={styles.questionSubtext}>Tap the option that best describes you</Text>
              {physical && (
                <View style={styles.previousAnswer}>
                  <Text style={styles.previousAnswerLabel}>Body: </Text>
                  <Text style={styles.previousAnswerEmoji}>{STATUS_META[physical].emoji}</Text>
                  <Text style={[styles.previousAnswerValue, { color: STATUS_META[physical].color }]}>
                    {STATUS_META[physical].short}
                  </Text>
                </View>
              )}
              <View style={styles.optionsGrid}>
                {statusOptions.map((opt) => (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Mind feels ${opt.label}`}
                    style={({ pressed }) => [
                      styles.optionButton,
                      { backgroundColor: STATUS_META[opt.value].bgColor, borderColor: STATUS_META[opt.value].color },
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => handleMentalSelect(opt.value)}>
                    <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.optionLabel, { color: STATUS_META[opt.value].color }]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 'note' && (
            <View style={styles.questionCard}>
              <Text style={styles.stepLabel}>Step 3 of 3</Text>
              <Text style={styles.questionTitle}>Anything to add?</Text>
              <Text style={styles.questionSubtext}>Optional — share a short note</Text>
              {physical && mental && (
                <View style={styles.previousAnswer}>
                  <Text style={styles.previousAnswerEmoji}>{STATUS_META[physical].emoji}</Text>
                  <Text style={styles.previousAnswerEmoji}>{STATUS_META[mental].emoji}</Text>
                  <Text style={styles.previousAnswerLabel}>
                    {STATUS_META[physical].short} · {STATUS_META[mental].short}
                  </Text>
                </View>
              )}
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
                onPress={() => { setNote(''); handleSubmit(); }}>
                <Text style={styles.skipText}>Skip & Submit</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 44,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.border,
  },
  progressDotActive: {
    backgroundColor: theme.primary,
    width: 28,
    borderRadius: 5,
  },
  progressDotDone: {
    backgroundColor: theme.primary,
    opacity: 0.4,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  stepLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    ...theme.cardShadow,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  previousAnswer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.background,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  previousAnswerLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  previousAnswerEmoji: {
    fontSize: 16,
  },
  previousAnswerValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  optionButton: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
    width: '47%',
    minHeight: 110,
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
    marginBottom: 10,
    lineHeight: 22,
  },
  doneTick: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneTreeLine: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
    marginBottom: 32,
  },
});
