# Tree Companion — Design Spec

**Date:** 2026-07-07
**Status:** Approved for planning

## Overview

Turn the Home screen's green hero into a living tree scene that grows with every check-in. The tree gives elderly users something to nurture, gives family a warmer signal than a green dot, and adds all-ages charm to the app. Family members can send "sunshine" back — a small two-way warmth loop.

Design mockups from the brainstorm session are in `.superpowers/brainstorm/1731-1783431379/content/` (gitignored, local only): `tree-style.html`, `growth-stages.html`, `home-design.html`.

## Decisions Made

| Question | Decision |
|---|---|
| Tree's role | Living tree that grows with check-ins (gamified companion) |
| Missed check-ins | Gentle: growth pauses only — the tree never wilts, dies, or loses progress |
| Placement | Home screen hero area (replaces current green hero block internals) |
| Visibility | Circle members see a mini version of your tree on your card |
| Long-term model | One companion tree, never resets; ongoing life after full growth |
| Visual style | Flat & Friendly (rounded flat shapes, on-palette greens, flowers, bird) with day/night sky |
| Rendering | Code-drawn SVG via `react-native-svg`; animation via existing `react-native-reanimated` |
| Extra feature in scope | Send Sunshine (family → sender reaction) |

## Growth Mechanics

- **Stage is a pure function of lifetime check-in count.** No resets, no decay. Missing days pauses growth and nothing else.

| Stage | Name | Lifetime check-ins |
|---|---|---|
| 1 | Seed | 0 |
| 2 | Sprout | 5+ |
| 3 | Sapling | 25+ |
| 4 | Young Tree | 60+ |
| 5 | Full Tree | 120+ |
| 6 | Blossoming | 200+ |

At a typical 3 check-ins/day, full bloom lands around the 2-month mark.

- **After Blossoming:** the tree lives on. For every 25 check-ins past 200, one blossom becomes a fruit (orange, matching the bird), up to 8 fruit — visual only, no new mechanics in v1.
- **Visitors (from existing streak data):** a bird appears while current streak ≥ 7 days; a butterfly joins while streak ≥ 30 days. Visitors leave when the streak drops — they are ambience, not progress, so this does not violate the no-punishment rule.

## Visual Design

- **Style:** Flat & Friendly — rounded geometric shapes, flat fills, no gradients on the tree itself. Palette anchors to `constants/Colors.ts`: canopy `#2E9E6E` / `#3FB07E` / highlight `#57C596`, trunk `#8B5E3C`, ground `#CDEBD9`, blossoms `#FFB7C5` with `#FFD166` centers, bird `#F4845F` (the CTA orange).
- **Day/night sky, by device clock:** day (07:00–18:59) — light sky `#DFF3E7`, sun `#FFE08A` with soft halo; night (19:00–06:59) — navy sky `#1F3A4D`, crescent moon, a few stars, tree/ground colors shift to darker variants. Two states only in v1 (no dawn/dusk).
- **Six stages** as approved in mockups: seed mound → sprout with two leaves → sapling → young tree → full tree → blossoming (flowers + bird).

## Home Screen (`app/(tabs)/index.tsx`)

- The hero keeps its structure (greeting, date, name, avatar, week dots, streak, chevron collapse) but its background becomes the `TreeScene`: sky, sun/moon, ground, tree at current stage.
- Text colors adapt to sky (dark green text on day sky, light text on night sky).
- **Tap the tree** → small progress readout: stage name, total check-ins, count to next stage (e.g. "Full Tree · 128 check-ins · 72 more to Blossoming"). Chevron collapse behavior is unchanged and separate.
- **New user (0 check-ins):** seed stage plus the line "Your tree is waiting for its first check-in 🌱" near the check-in CTA.
- **Stage-up celebration:** when fetched stage > last-seen stage (AsyncStorage), play a one-time scale/petal animation.
- **Received sunshine:** suns from the last 48h float near the canopy with sender first names; a banner ("Sarah sent you sunshine ☀️") shows when there is sunshine newer than the last Home visit.

## Circle Screen + Send Sunshine

- Each person's card gains a **mini tree thumbnail** (simplified `TreeScene`, light background, no sky) plus a line like "🌸 Blossoming · 41-day streak".
- **☀️ Send Sunshine button** on each card (≥48dp): sends a sunshine to that person, then shows a sent/disabled state until they can receive again.
- **Rate limit:** one sunshine per sender→recipient pair per rolling 20 hours (sidesteps timezone day-boundary math).
- Recipient gets a push notification via the existing Expo pipeline: "Sarah sent you sunshine ☀️".

## Data Model & API

**New table `sunshines`:**

```sql
create table sunshines (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on sunshines (to_user_id, created_at);
create index on sunshines (from_user_id, to_user_id, created_at);
```

No schema change for growth — stage derives from a `count(*)` of the user's check-ins (fine at MVP scale; denormalize later if needed).

**API changes:**

- `GET /checkins/stats` (existing) — add `totalCheckins`, `treeStage` (1–6), `toNextStage` (check-ins remaining, null at stage 6), and `sunshines` (last 48h: `[{ fromName, createdAt }]`).
- Circle/contacts list endpoint (existing) — add `treeStage` and `currentStreak` per monitored person.
- `POST /circle/:userId/sunshine` (new) — validates that `:userId` has the caller as an active contact (the circle relationship); rejects (409) if a sunshine from this sender to this recipient exists within the past 20 hours; inserts row; sends push. The 409 response includes `nextAllowedAt`.

## Client Components

- `app/components/tree/Tree.tsx` — parametric SVG tree; props: `stage` (1–6), `palette` (day/night).
- `app/components/tree/TreeScene.tsx` — composes sky, sun/moon, ground, `Tree`, sunshine suns, visitors; props: `stage`, `streak`, `sunshines`, `size` (`hero` | `mini`). `mini` drops sky, visitors, and sunshine.
- Animations (reanimated): slow canopy sway loop; spring pop-in for sunshine suns; stage-up celebration.
- New dependency: `react-native-svg` (via `expo install`).

## Edge Cases & Accessibility

- **API failure/offline:** hydrate last tree payload from AsyncStorage so the hero never flashes back to seed; refresh silently (matches existing Home error pattern).
- **Removed contact:** sunshine endpoint re-validates the relationship server-side.
- **Accessibility:** `TreeScene` exposes a summary label ("Your tree: Full Tree, 128 check-ins, 4-day streak, sunshine from Sarah"). Sunshine button ≥48dp with label "Send sunshine to {name}". Tree is decorative enhancement — all information it conveys is also available as text.

## Testing

- **Server:** unit tests for stage thresholds at boundary values (0, 4, 5, 24, 25, …, 200); sunshine rate-limit (within/outside 20h); relationship validation on send.
- **Client:** manual visual checklist rendering all 6 stages in both palettes (the app has no test framework, and adding one for a snapshot test would be overengineering); manual visual pass of day/night by adjusting device clock.

## Out of Scope (Backlog)

- Milestone push alerts to family ("Mum's tree just blossomed 🌸")
- Weekly shareable tree postcard (WhatsApp viral loop)
- Seasonal/festive dress-up (CNY lanterns, Raya ketupat, Deepavali/Christmas lights)
- Grove/multi-tree collection; tree species
- Dawn/dusk sky states; weather effects
