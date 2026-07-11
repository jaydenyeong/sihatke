# Check-in Done State + Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home clearly shows a "checked in today ✓" state with a change option, and the check-in success + Home state-flip moments get gentle animations.

**Architecture:** One new state-aware `CheckinCard` component replaces Home's status card + CTA card. The `Petal` animation is extracted from `TreeScene` into a shared component and reused on a reworked check-in Done screen. All motion is `react-native-reanimated` with `ReduceMotion.System`. No backend changes, no new dependencies.

**Tech Stack:** React Native / Expo SDK 54, TypeScript, `react-native-reanimated` ~4.1.1, FontAwesome icons.

**Spec:** `docs/superpowers/specs/2026-07-11-checkin-state-motion-design.md`

## Global Constraints

- **No new dependencies.** Only `react-native-reanimated` and existing libs.
- **Every new animation config sets `reduceMotion: ReduceMotion.System`** (and entering builders use `.reduceMotion(ReduceMotion.System)`).
- **Exact copy strings:** "You've checked in today", "Check in again", "Next reminder: {HH:MM}", "See you tomorrow 🌙", "Your tree just got a little water 🌱". No guilt language anywhere.
- **Touch targets ≥48dp**; interactive elements get `accessibilityRole` + `accessibilityLabel`; decorative tick circles hidden from screen readers.
- **"Change" = new check-in via the same flow** (POST as today; latest wins). No edit endpoint.
- **Verification gate per task:** `cd app && npx tsc --noEmit` completely clean. The app has no test framework (standing project decision); the final device checklist in Task 3 covers behavior.
- App path alias: `@/` → `app/`. All work in `app/`.
- Commit after every task.

---

### Task 1: Extract shared `Petal` component

**Files:**
- Create: `app/components/tree/Petal.tsx`
- Modify: `app/components/tree/TreeScene.tsx` (remove internal `Petal` + `petal` style, import shared one)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 3): `Petal({ index, left, top }: { index: number; left: number; top: number })` — absolutely-positioned 10×10 pink petal that falls/fades once on mount, staggered by `index`.

- [ ] **Step 1: Create the shared component**

Create `app/components/tree/Petal.tsx`:

```tsx
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface PetalProps {
  index: number;
  left: number;
  top: number;
}

/** A single falling blossom petal. Animates once on mount, staggered by index. */
export function Petal({ index, left, top }: PetalProps) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withDelay(
      index * 120,
      withTiming(1, {
        duration: 1600,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [fall, index]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - fall.value,
    transform: [
      { translateY: fall.value * 130 },
      { translateX: Math.sin(index) * 24 * fall.value },
    ],
  }));
  return <Animated.View style={[styles.petal, { left, top }, style]} />;
}

const styles = StyleSheet.create({
  petal: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFB7C5',
  },
});
```

(Behavior is identical to the `Petal` currently inside `TreeScene.tsx`, plus `reduceMotion` — with Reduce Motion on, the timing jumps to its final value and the petal is simply invisible.)

- [ ] **Step 2: Use it in TreeScene**

In `app/components/tree/TreeScene.tsx`:

1. Delete the whole internal `function Petal({ index }: { index: number }) { ... }` block (currently lines 50–70).
2. Delete the `petal` entry from the `StyleSheet.create` block at the bottom.
3. Add the import: `import { Petal } from './Petal';`
4. Replace the celebration render at the bottom of the hero return:

```tsx
      {/* One-shot petal celebration */}
      {celebrate &&
        Array.from({ length: PETAL_COUNT }, (_, i) => (
          <Petal key={i} index={i} left={60 + i * 36} top={20 + (i % 3) * 10} />
        ))}
```

(The `left`/`top` values are exactly what the old internal component computed from `index`.)

5. If `Easing` or `withDelay`/`withTiming` are now unused in `TreeScene.tsx`, leave them if still used by the sway effect (they are — the sway uses `withTiming`/`Easing`, and `withDelay` is still used by `SunshineSun`). Remove nothing else.

- [ ] **Step 3: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/components/tree/Petal.tsx app/components/tree/TreeScene.tsx
git commit -m "refactor(app): extract shared Petal with reduce-motion support"
```

---

### Task 2: `CheckinCard` + Home integration

**Files:**
- Create: `app/components/CheckinCard.tsx`
- Modify: `app/app/(tabs)/index.tsx` (swap status card + CTA card for `CheckinCard`, prune dead styles/imports)

**Interfaces:**
- Consumes: `Checkin` type, `STATUS_META` from `@/lib/status`, `theme`.
- Produces: `CheckinCard({ todaysCheckin, checkinTimes, onStartCheckin }: { todaysCheckin: Checkin | null; checkinTimes: string[]; onStartCheckin: () => void })`.

- [ ] **Step 1: Create the component**

Create `app/components/CheckinCard.tsx`:

```tsx
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
  },
  againButtonText: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: '700',
  },
});
```

- [ ] **Step 2: Swap it into Home**

In `app/app/(tabs)/index.tsx`:

1. Add import: `import { CheckinCard } from '@/components/CheckinCard';`
2. Remove the now-unused import: `import { STATUS_META } from '@/lib/status';` (CheckinCard owns it now).
3. Inside `<View style={styles.body}>`, KEEP the `timesRow` block, then replace EVERYTHING from `{todaysCheckin ? (` down to the closing `</View>` of the `ctaCard` (the whole status-card ternary AND the CTA card) with:

```tsx
          <CheckinCard
            todaysCheckin={todaysCheckin}
            checkinTimes={checkinTimes}
            onStartCheckin={() => router.push('/checkin')}
          />
```

4. Delete these now-dead entries from the StyleSheet: `statusCard`, `cardLabel`, `cardSubtext`, `statusRow`, `statusBadge`, `statusBadgeEmoji`, `statusBadgeText`, `checkinTime`, `ctaCard`, `ctaTitle`, `ctaSubtext`, `ctaButton`, `ctaButtonPressed`, `ctaButtonText`, and the already-dead `nudgeCard`, `nudgeBody`, `nudgeTitle`, `nudgeSubtext` (leftovers from the removed nudge card).

- [ ] **Step 3: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: no output, exit 0. (If `STATUS_META` or any deleted style is still referenced, tsc/grep will say so — `grep -n "statusCard\|ctaCard\|nudge" "app/app/(tabs)/index.tsx"` should return nothing.)

- [ ] **Step 4: Commit**

```bash
git add app/components/CheckinCard.tsx "app/app/(tabs)/index.tsx"
git commit -m "feat(app): state-aware check-in card with done state on Home"
```

---

### Task 3: Check-in success celebration

**Files:**
- Modify: `app/app/(tabs)/checkin.tsx` (rework the `done` step)

**Interfaces:**
- Consumes: `Petal` from Task 1 (`@/components/tree/Petal`).
- Produces: final user-facing behavior; nothing downstream.

**Note:** `checkin.tsx` already imports `Animated` from `react-native` (the slide-in uses it). Import reanimated's default under the alias `Reanimated` to avoid the collision.

- [ ] **Step 1: Rework the done step**

In `app/app/(tabs)/checkin.tsx`:

1. Add imports (keeping the existing `Animated` from `react-native` untouched):

```tsx
import Reanimated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Petal } from '@/components/tree/Petal';
```

2. Add a `SuccessTick` component above `CheckInScreen` (module level, after `useSlideIn`):

```tsx
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
```

3. Replace the `done` step's JSX (the current `if (step === 'done') { return ( ... ) }` block) with:

```tsx
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
```

4. Style changes in the StyleSheet: delete `doneEmoji`; change `doneSubtext`'s `marginBottom` from `32` to `10`; add:

```tsx
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
```

(`doneCard` already fills the screen and centers content; the absolutely-positioned petals fall from its top area across the width.)

- [ ] **Step 2: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 3: Device checklist (human)**

With the dev server running (`cd app && npm run start:lan`):
1. Fresh day, no check-in → Home shows "How are you feeling?" + orange Start Check-In.
2. Complete the flow → Done screen: green tick springs in, 8 petals drift down once, "Your tree just got a little water 🌱".
3. Back to Home → card shows tick pop + "You've checked in today", your two badges, "at {time}", "Next reminder: {HH:MM}" (or "See you tomorrow 🌙" if past the last scheduled time), outline "Check in again".
4. Tap "Check in again", pick different answers → returning Home cross-fades the new badges.
5. Enable system Reduce Motion → repeat steps 2–3: no animations, all content fully readable.

- [ ] **Step 4: Commit**

```bash
git add "app/app/(tabs)/checkin.tsx"
git commit -m "feat(app): check-in success celebration with petals + tree line"
```
