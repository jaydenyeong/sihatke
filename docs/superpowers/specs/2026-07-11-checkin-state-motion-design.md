# Check-in Done State + Motion — Design Spec

**Date:** 2026-07-11
**Status:** Approved for planning

## Overview

Two UX improvements from device testing of the tree companion release:

1. Home must clearly show when the user has already checked in today, with an option to change it.
2. Add motion to the two moments that matter: completing a check-in, and Home flipping to its "done" state.

No backend changes. "Changing" a check-in = submitting the flow again (a new row; the latest check-in is what family sees). This preserves history, trend detection, and already-fired alerts. No true-edit endpoint.

## Decisions Made

| Question | Decision |
|---|---|
| Done-state presentation | One state-aware card replacing the two current cards (status card + CTA card) |
| "Change" semantics | New check-in via the same flow; latest wins for display. No PUT endpoint |
| Motion scope | Check-in success celebration + Home done-state transition only |
| Not in scope | Micro-interactions (button bounces, dot stagger), tab/screen transitions, haptics, Lottie |
| Dependencies | None new — `react-native-reanimated` + `react-native-svg` already installed |

## 1. `CheckinCard` component (new)

`app/components/CheckinCard.tsx`, rendered by Home (`app/app/(tabs)/index.tsx`) in place of the current `statusCard` + `ctaCard` blocks (both removed, along with their now-unused styles). The bell/times row above the card stays unchanged.

**Props:**

```ts
interface CheckinCardProps {
  todaysCheckin: Checkin | null;   // Home already derives this from /checkins/latest
  checkinTimes: string[];          // "HH:MM" strings from /auth/me
  onStartCheckin: () => void;      // router.push('/checkin')
}
```

**Not-checked-in state** (todaysCheckin === null): visually identical to the current CTA card — heartbeat icon, "How are you feeling?", subtext, full-width orange **Start Check-In** button (existing styles move into the component).

**Checked-in state:**
- Green circle (56dp, `theme.primary` background) with a white FontAwesome `check` icon — pops in with a spring on mount.
- Title: **"You've checked in today"**.
- The body/mind status badges + check-in time, reusing the exact badge styling from the removed status card (`STATUS_META` colors/emoji/short labels).
- Reminder line, computed from `checkinTimes` vs the device clock: first "HH:MM" strictly after now → `Next reminder: {HH:MM}` (shown raw, matching the times row's format); none left today → `See you tomorrow 🌙`; `checkinTimes` empty → line omitted.
- Secondary outline button **"Check in again"** (transparent background, 2dp `theme.primary` border, `theme.primary` text, ≥56dp tall, full width) → `onStartCheckin`.
- Accessibility: tick circle is decorative and hidden from screen readers (`accessibilityElementsHidden` on iOS / `importantForAccessibility="no-hide-descendants"` on Android); the card's state is conveyed by the title text; button labeled "Check in again".

## 2. Done-state transition (Home)

- The checked-in content wrapper uses reanimated `entering={FadeIn}`; the tick circle runs a `withSpring` scale 0→1 on mount.
- The badge row + time are wrapped in a `View` keyed by `todaysCheckin._id`, with `entering={FadeIn}` — so returning from "Check in again" with new answers cross-fades the badges instead of snapping.
- No exit animations (content swap is fine; keep it simple).

## 3. Check-in success celebration

In `app/app/(tabs)/checkin.tsx`, the `done` step is reworked:

- The static `✅` emoji is replaced by a green-circle-with-check element matching the CheckinCard tick's look (parallel styling is fine — no shared component needed for ~5 lines of JSX), springing in (scale 0→1, `withSpring`, damping ≈ 8).
- 8 pink petals drift down once across the card width on mount.
- Copy: title "Check-in Complete!" and subtext stay; add a third line: **"Your tree just got a little water 🌱"**.
- **Back to Home** button unchanged — manual navigation only, no auto-redirect.

**Petal extraction (DRY):** the private `Petal` component inside `app/components/tree/TreeScene.tsx` moves to `app/components/tree/Petal.tsx` with props `{ index: number; left: number; top: number }` (same fall animation: translateY + sine-drift translateX + fade over ~1.6s, staggered by index). TreeScene and the done screen both import it and compute their own positions. Behavior in TreeScene is unchanged.

## 4. Gentleness & accessibility

- Every **new** `withSpring`/`withTiming` config (tick pops, petal fall) sets `reduceMotion: ReduceMotion.System` so the OS Reduce Motion setting disables them. Since `Petal` is shared, TreeScene's celebration petals gain this too — an intentional improvement.
- Animations are decorative only: they never delay or block a tap, and every state is fully readable with animations off.
- All copy stays guilt-free (no "you missed…" language anywhere).

## Edge cases

- Day rollover while Home is open: `todaysCheckin` derives from `isToday(latest.createdAt)` on each focus/render — after midnight the card naturally reverts to the not-checked-in state on next focus.
- Multiple check-ins per day: card always shows the latest one (existing `/checkins/latest` behavior).
- Reminder line uses simple string comparison on "HH:MM" 24h values against the current device time — no timezone math needed.

## Testing

- `cd app && npx tsc --noEmit` clean (no app test framework, per standing decision).
- Device checklist: fresh day → CTA state; complete flow → celebration (tick spring + petals + tree line) → Home shows done state with tick pop; "Check in again" → new answers cross-fade in; last scheduled time passed → "See you tomorrow 🌙"; Reduce Motion on → no animations, all content readable.

## Out of Scope (Backlog)

- Micro-interactions (press bounces, week-dot stagger, streak flame pulse)
- Tab/screen transition polish
- Success haptics (`expo-haptics`)
- True edit of a submitted check-in (PUT endpoint)
