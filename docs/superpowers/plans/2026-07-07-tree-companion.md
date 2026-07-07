# Tree Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A living tree on the Home screen that grows with lifetime check-ins, is visible to circle members as a mini tree, and lets family send "sunshine" back.

**Architecture:** Tree stage is a pure function of lifetime check-in count, computed server-side and returned by the existing `/checkins/stats` and `/circle` endpoints. One new table (`sunshines`) and one new endpoint (`POST /circle/:userId/sunshine`). The tree is drawn client-side as parametric SVG (`react-native-svg`) with a day/night palette chosen by device clock; motion via the already-installed `react-native-reanimated`.

**Tech Stack:** Express 5 + TypeScript + Supabase (server), React Native / Expo SDK 54 + expo-router (app), vitest (new, server dev-dependency), react-native-svg (new, app dependency).

**Spec:** `docs/superpowers/specs/2026-07-07-tree-companion-design.md`

## Global Constraints

- **Gentle mechanics, no punishment:** the tree never wilts, dies, or loses progress. No copy anywhere may guilt the user about missed days.
- **Stage thresholds (lifetime check-ins):** Seed 0, Sprout 5, Sapling 25, Young Tree 60, Full Tree 120, Blossoming 200. Fruit: one per 25 check-ins past 200, max 8.
- **Sunshine rate limit:** one per sender→recipient pair per rolling 20 hours.
- **Day/night:** day = 07:00–18:59 device local time, night otherwise. Two states only.
- **Palette (exact hexes):** day sky `#DFF3E7`, night sky `#1F3A4D`, canopy `#2E9E6E`, side canopy `#3FB07E`, highlight `#57C596`, trunk `#8B5E3C`, ground `#CDEBD9`, blossom `#FFB7C5`, blossom center `#FFD166`, fruit/bird `#F4845F`, sun `#FFE08A`, moon `#FFE9A8`. Night tree variants: canopy `#256B4E`, side `#2E7D5B`, highlight `#3E8E68`, trunk `#5E4126`, ground `#2C4A3E`, blossom `#D98A9C`, blossom center `#D9B25A`, fruit `#C96B4A`.
- **Accessibility:** touch targets ≥48dp; every interactive element gets `accessibilityRole` and `accessibilityLabel`; the tree scene exposes a text summary label.
- **New dependencies limited to:** `react-native-svg` (app, via `expo install`), `vitest` (server, devDependency). Nothing else.
- **All server work in `server/`, all app work in `app/`.** Path alias `@/` maps to `app/` in the mobile project.
- Commit after every task. Server must pass `npm run build` (tsc) and `npm test` before each server commit.

---

### Task 1: Server — tree stage logic (`treeService`) with vitest

**Files:**
- Modify: `server/package.json` (add vitest + test script)
- Create: `server/src/services/treeService.ts`
- Test: `server/src/services/treeService.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces (used by Tasks 2, 3, 4):
  - `treeStateFor(totalCheckins: number): TreeState` where `TreeState = { stage: TreeStage; toNextStage: number | null; fruitCount: number }` and `TreeStage = 1 | 2 | 3 | 4 | 5 | 6`
  - `canSendSunshine(lastSentAt: string | null, now?: Date): boolean`
  - `nextAllowedAt(lastSentAt: string): string`
  - `SUNSHINE_COOLDOWN_HOURS = 20`

- [ ] **Step 1: Install vitest and add the test script**

```bash
cd server && npm install --save-dev vitest
```

In `server/package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing tests**

Create `server/src/services/treeService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  canSendSunshine,
  nextAllowedAt,
  treeStateFor,
} from './treeService';

describe('treeStateFor', () => {
  it.each([
    [0, 1], [4, 1],
    [5, 2], [24, 2],
    [25, 3], [59, 3],
    [60, 4], [119, 4],
    [120, 5], [199, 5],
    [200, 6], [999, 6],
  ])('%i check-ins → stage %i', (total, stage) => {
    expect(treeStateFor(total).stage).toBe(stage);
  });

  it('reports check-ins remaining to the next stage', () => {
    expect(treeStateFor(0).toNextStage).toBe(5);
    expect(treeStateFor(5).toNextStage).toBe(20);
    expect(treeStateFor(128).toNextStage).toBe(72);
    expect(treeStateFor(199).toNextStage).toBe(1);
  });

  it('has no next stage at Blossoming', () => {
    expect(treeStateFor(200).toNextStage).toBeNull();
    expect(treeStateFor(500).toNextStage).toBeNull();
  });

  it('grows one fruit per 25 check-ins past 200, capped at 8', () => {
    expect(treeStateFor(199).fruitCount).toBe(0);
    expect(treeStateFor(200).fruitCount).toBe(0);
    expect(treeStateFor(224).fruitCount).toBe(0);
    expect(treeStateFor(225).fruitCount).toBe(1);
    expect(treeStateFor(400).fruitCount).toBe(8);
    expect(treeStateFor(9999).fruitCount).toBe(8);
  });
});

describe('canSendSunshine', () => {
  const now = new Date('2026-07-07T12:00:00Z');

  it('allows when never sent before', () => {
    expect(canSendSunshine(null, now)).toBe(true);
  });

  it('blocks within 20 hours', () => {
    expect(canSendSunshine('2026-07-07T11:00:00Z', now)).toBe(false);
    expect(canSendSunshine('2026-07-06T16:00:01Z', now)).toBe(false);
  });

  it('allows at exactly 20 hours and beyond', () => {
    expect(canSendSunshine('2026-07-06T16:00:00Z', now)).toBe(true);
    expect(canSendSunshine('2026-07-01T00:00:00Z', now)).toBe(true);
  });
});

describe('nextAllowedAt', () => {
  it('is lastSentAt + 20 hours', () => {
    expect(nextAllowedAt('2026-07-07T11:00:00Z')).toBe('2026-07-08T07:00:00.000Z');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd server && npm test`
Expected: FAIL — cannot resolve `./treeService`.

- [ ] **Step 4: Write the implementation**

Create `server/src/services/treeService.ts`:

```ts
export type TreeStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface TreeState {
  stage: TreeStage;
  /** Check-ins remaining until the next stage; null at Blossoming. */
  toNextStage: number | null;
  /** 0–8 fruit, only ever non-zero at Blossoming. */
  fruitCount: number;
}

/** Lifetime check-ins needed to reach stage index+1. */
export const STAGE_THRESHOLDS = [0, 5, 25, 60, 120, 200] as const;

const FRUIT_INTERVAL = 25;
const FRUIT_MAX = 8;

export function treeStateFor(totalCheckins: number): TreeState {
  let stage: TreeStage = 1;
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalCheckins >= STAGE_THRESHOLDS[i]) {
      stage = (i + 1) as TreeStage;
      break;
    }
  }
  const toNextStage =
    stage === 6 ? null : STAGE_THRESHOLDS[stage] - totalCheckins;
  const fruitCount =
    stage === 6
      ? Math.min(FRUIT_MAX, Math.floor((totalCheckins - 200) / FRUIT_INTERVAL))
      : 0;
  return { stage, toNextStage, fruitCount };
}

export const SUNSHINE_COOLDOWN_HOURS = 20;
const COOLDOWN_MS = SUNSHINE_COOLDOWN_HOURS * 60 * 60 * 1000;

export function canSendSunshine(
  lastSentAt: string | null,
  now: Date = new Date()
): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - new Date(lastSentAt).getTime() >= COOLDOWN_MS;
}

export function nextAllowedAt(lastSentAt: string): string {
  return new Date(new Date(lastSentAt).getTime() + COOLDOWN_MS).toISOString();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npm test`
Expected: PASS — all treeService tests green.

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/src/services/treeService.ts server/src/services/treeService.test.ts
git commit -m "feat(server): tree stage logic + sunshine cooldown, with vitest"
```

---

### Task 2: Server — `sunshines` table + extended `/checkins/stats`

**Files:**
- Create: `server/supabase/migrations/add_sunshines.sql`
- Modify: `server/supabase/schema.sql` (keep canonical schema current)
- Modify: `server/src/db/types.ts` (add `SunshineRow`)
- Modify: `server/src/routes/checkins.ts:189-245` (stats handler)

**Interfaces:**
- Consumes: `treeStateFor` from Task 1.
- Produces (used by Tasks 3, 7): `GET /api/checkins/stats` response shape:
  ```json
  {
    "currentStreak": 4, "weekDots": [true, ...7], "totalCheckins": 128,
    "treeStage": 5, "toNextStage": 72, "fruitCount": 0,
    "sunshines": [{ "fromName": "Sarah Lee", "createdAt": "2026-07-07T03:00:00Z" }]
  }
  ```
  `sunshines` contains only the last 48 hours, newest first. Table `sunshines(id, from_user_id, to_user_id, created_at)`.

- [ ] **Step 1: Write the migration**

Create `server/supabase/migrations/add_sunshines.sql`:

```sql
-- Migration: sunshine reactions (family → sender)
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS sunshines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sunshines_to
  ON sunshines (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sunshines_from_to
  ON sunshines (from_user_id, to_user_id, created_at DESC);
```

Also append the same `CREATE TABLE` + indexes (without `IF NOT EXISTS` guards, matching house style) to `server/supabase/schema.sql`, and add `DROP TABLE IF EXISTS sunshines CASCADE;` to the drop block at the top (before `push_tokens` so FK order is safe).

- [ ] **Step 2: Run the migration manually**

Open Supabase Dashboard → project `sihatke` → SQL Editor → paste `add_sunshines.sql` → Run.
Expected: "Success. No rows returned." and `sunshines` visible in Table Editor.

- [ ] **Step 3: Add the row type**

In `server/src/db/types.ts`, append:

```ts
export interface SunshineRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
}
```

- [ ] **Step 4: Extend the stats handler**

In `server/src/routes/checkins.ts`, add imports at the top:

```ts
import { treeStateFor } from '../services/treeService';
```

In the `GET /stats` handler, replace the final `res.json({ currentStreak, weekDots, totalCheckins: total ?? 0 });` with:

```ts
    const tree = treeStateFor(total ?? 0);

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: sunRows } = await db()
      .from('sunshines')
      .select('from_user_id, created_at')
      .eq('to_user_id', req.userId!)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    let sunshines: { fromName: string; createdAt: string }[] = [];
    const rows = (sunRows ?? []) as Pick<SunshineRow, 'from_user_id' | 'created_at'>[];
    if (rows.length > 0) {
      const senderIds = [...new Set(rows.map((r) => r.from_user_id))];
      const { data: senders } = await db()
        .from('users')
        .select('id, full_name')
        .in('id', senderIds);
      const nameById = new Map(
        ((senders ?? []) as Pick<UserRow, 'id' | 'full_name'>[]).map((u) => [u.id, u.full_name])
      );
      sunshines = rows.map((r) => ({
        fromName: nameById.get(r.from_user_id) ?? 'Someone',
        createdAt: r.created_at,
      }));
    }

    res.json({
      currentStreak,
      weekDots,
      totalCheckins: total ?? 0,
      treeStage: tree.stage,
      toNextStage: tree.toNextStage,
      fruitCount: tree.fruitCount,
      sunshines,
    });
```

Add `SunshineRow` to the existing type import from `../db/types`.

- [ ] **Step 5: Verify**

Run: `cd server && npm run build && npm test`
Expected: tsc clean, tests green.

Run the server (`npm run dev`) and, with a valid JWT (log in via the app or `POST /api/auth/login` with curl):

```bash
curl -s http://localhost:3000/api/checkins/stats -H "Authorization: Bearer <TOKEN>"
```

Expected: JSON containing `treeStage`, `toNextStage`, `fruitCount`, and `sunshines: []`.

- [ ] **Step 6: Commit**

```bash
git add server/supabase server/src/db/types.ts server/src/routes/checkins.ts
git commit -m "feat(server): sunshines table + tree state in /checkins/stats"
```

---

### Task 3: Server — `POST /circle/:userId/sunshine`

**Files:**
- Modify: `server/src/routes/circle.ts`

**Interfaces:**
- Consumes: `canSendSunshine`, `nextAllowedAt` (Task 1); `sunshines` table (Task 2); `sendPushToUsers(userIds, title, body, data?)` from `server/src/services/notificationService.ts`.
- Produces (used by Task 8): `POST /api/circle/:userId/sunshine` → `201 { ok: true }`; `404 { error }` if `:userId` has not added the caller as an **active** contact; `409 { error, nextAllowedAt }` inside the 20-hour cooldown.

- [ ] **Step 1: Add the route**

In `server/src/routes/circle.ts`, add imports:

```ts
import type { CheckinRow, SunshineRow, UserRow } from '../db/types';
import { canSendSunshine, nextAllowedAt } from '../services/treeService';
import { sendPushToUsers } from '../services/notificationService';
```

(The `CheckinRow`/`UserRow` import line already exists — extend it.)

Below the existing `GET /` handler, add:

```ts
/**
 * POST /api/circle/:userId/sunshine
 * Send a sunshine reaction to a sender I watch. The sender must have
 * added me as an active contact. Max one per sender→recipient per 20h.
 */
router.post('/:userId/sunshine', auth, async (req: AuthRequest, res: Response) => {
  try {
    const toUserId = req.params.userId;

    const { data: link } = await db()
      .from('contacts')
      .select('id')
      .eq('user_id', toUserId)
      .eq('contact_user_id', req.userId!)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!link) {
      res.status(404).json({ error: 'This person is not in your circle' });
      return;
    }

    const { data: last } = await db()
      .from('sunshines')
      .select('created_at')
      .eq('from_user_id', req.userId!)
      .eq('to_user_id', toUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSentAt = (last as Pick<SunshineRow, 'created_at'> | null)?.created_at ?? null;
    if (!canSendSunshine(lastSentAt)) {
      res.status(409).json({
        error: 'You already sent sunshine recently',
        nextAllowedAt: nextAllowedAt(lastSentAt!),
      });
      return;
    }

    const { error } = await db()
      .from('sunshines')
      .insert({ from_user_id: req.userId!, to_user_id: toUserId });

    if (error) {
      console.error('Sunshine insert error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    // Fire-and-forget push to the recipient
    (async () => {
      try {
        const { data: me } = await db()
          .from('users')
          .select('full_name')
          .eq('id', req.userId!)
          .maybeSingle();
        const firstName =
          ((me as Pick<UserRow, 'full_name'> | null)?.full_name ?? 'Someone').split(' ')[0];
        await sendPushToUsers(
          [toUserId],
          'Sunshine for you ☀️',
          `${firstName} sent you sunshine ☀️`,
          { kind: 'sunshine' }
        );
      } catch (err) {
        console.error('Sunshine push failed:', err);
      }
    })();

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Sunshine error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 2: Verify**

Run: `cd server && npm run build && npm test`
Expected: clean.

With two linked accounts (A = sender/elderly who added B as an active contact; B = receiver):

```bash
# As B (use B's token, A's user id):
curl -s -X POST http://localhost:3000/api/circle/<A_USER_ID>/sunshine -H "Authorization: Bearer <B_TOKEN>"
```

Expected: `{"ok":true}` (201). Repeat immediately → `409` with `nextAllowedAt`. Against a random UUID → `404`. Check `GET /api/checkins/stats` as A → `sunshines` contains B's full name.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/circle.ts
git commit -m "feat(server): send-sunshine endpoint with 20h cooldown + push"
```

---

### Task 4: Server — shared streak helpers + tree data in `GET /circle`

**Files:**
- Create: `server/src/services/statsService.ts`
- Modify: `server/src/routes/checkins.ts` (delete its local `localDateString`/`computeStreak`, import instead)
- Modify: `server/src/routes/circle.ts` (extend `GET /` response)

**Interfaces:**
- Consumes: `treeStateFor` (Task 1).
- Produces (used by Task 8): each `GET /api/circle` member gains `treeStage` (1–6) and `currentStreak` (number). Also exports for server-internal reuse: `localDateString(tz: string, date: Date): string`, `streakFromDates(dates: Set<string>, tz: string): number`, `computeStreak(userId: string, tz: string): Promise<number>`.

- [ ] **Step 1: Extract the streak helpers**

Create `server/src/services/statsService.ts` — move the code verbatim from `server/src/routes/checkins.ts:19-62`, splitting the streak walk into a pure function:

```ts
import { db } from '../db/supabase';

export function localDateString(tz: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Consecutive-day streak ending today or yesterday, given local date strings. */
export function streakFromDates(checkinDates: Set<string>, tz: string): number {
  const todayLocal = localDateString(tz, new Date());
  const yesterdayLocal = localDateString(tz, new Date(Date.now() - 86400000));
  const startOffset = checkinDates.has(todayLocal) ? 0
    : checkinDates.has(yesterdayLocal) ? 1
    : -1;
  if (startOffset < 0) return 0;

  let streak = 0;
  for (let i = startOffset; i < 35; i++) {
    const day = localDateString(tz, new Date(Date.now() - i * 86400000));
    if (checkinDates.has(day)) streak++;
    else break;
  }
  return streak;
}

export async function computeStreak(userId: string, tz: string): Promise<number> {
  const windowStart = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db()
    .from('checkins')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', windowStart);

  const checkinDates = new Set<string>();
  for (const c of (data ?? []) as { created_at: string }[]) {
    checkinDates.add(localDateString(tz, new Date(c.created_at)));
  }
  return streakFromDates(checkinDates, tz);
}
```

- [ ] **Step 2: Refactor `checkins.ts` to use it**

In `server/src/routes/checkins.ts`:
- Delete the local `localDateString` (lines 19–30) and `computeStreak` (lines 32–62).
- Add `import { computeStreak, localDateString, streakFromDates } from '../services/statsService';`
- In the `GET /stats` handler, replace the inline streak block (`const todayLocal = ...` through the `for` loop, lines 224–238) with:

```ts
    const currentStreak = streakFromDates(checkinDates, tz);
```

The milestone check in `POST /` keeps calling `computeStreak(userId, tz)` — now the imported one.

- [ ] **Step 3: Extend `GET /circle`**

In `server/src/routes/circle.ts`, add imports:

```ts
import { treeStateFor } from '../services/treeService';
import { computeStreak } from '../services/statsService';
```

Change the profile fetch (step 2 of the handler) to also select timezone:

```ts
      .select('id, full_name, timezone')
```

and the row type to `Pick<UserRow, 'id' | 'full_name' | 'timezone'>[]`.

Replace the body of the `results` mapper so each member also gets a check-in count and streak:

```ts
    const results = await Promise.all(
      (users as Pick<UserRow, 'id' | 'full_name' | 'timezone'>[]).map(async (user) => {
        const [{ data: checkin }, { count }, currentStreak] = await Promise.all([
          db()
            .from('checkins')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          db()
            .from('checkins')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          computeStreak(user.id, user.timezone || 'UTC'),
        ]);

        return {
          _id: user.id,
          fullName: user.full_name,
          latestCheckin: checkin ? mapCheckin(checkin as CheckinRow) : null,
          treeStage: treeStateFor(count ?? 0).stage,
          currentStreak,
        };
      })
    );
```

- [ ] **Step 4: Verify**

Run: `cd server && npm run build && npm test`
Expected: clean.

```bash
curl -s http://localhost:3000/api/circle -H "Authorization: Bearer <B_TOKEN>"
```

Expected: each member object includes `treeStage` and `currentStreak`. `GET /api/checkins/stats` still returns the same `currentStreak`/`weekDots` values as before the refactor.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/statsService.ts server/src/routes/checkins.ts server/src/routes/circle.ts
git commit -m "refactor(server): shared streak helpers; tree stage + streak in /circle"
```

---

### Task 5: App — `react-native-svg`, palette, stage metadata, `TreeFigure`

**Files:**
- Modify: `app/package.json` (via `expo install react-native-svg`)
- Create: `app/lib/tree.ts`
- Create: `app/components/tree/palette.ts`
- Create: `app/components/tree/Tree.tsx`
- Modify (temporary, reverted in this task): `app/app/(tabs)/index.tsx` for visual verification

**Interfaces:**
- Consumes: `TreeStage` type (added to `app/lib/types.ts` here, matching the server's 1–6).
- Produces (used by Tasks 6, 7, 8):
  - `app/lib/types.ts`: `export type TreeStage = 1 | 2 | 3 | 4 | 5 | 6;`
  - `app/lib/tree.ts`: `STAGE_META: Record<TreeStage, { name: string; emoji: string }>`, `isNightAt(hour: number): boolean`
  - `palette.ts`: `TreePalette` interface, `DAY_PALETTE`, `NIGHT_PALETTE`, `paletteForDate(d?: Date): TreePalette`
  - `Tree.tsx`: `TreeFigure({ stage, fruitCount, palette })` — an SVG fragment (`<G>…`) drawn in a **200×170 coordinate space with the trunk base at y=160, centered on x=100**, for embedding in a parent `<Svg>`.

- [ ] **Step 1: Install react-native-svg**

```bash
cd app && npx expo install react-native-svg
```

Expected: installs the SDK-54-pinned version without peer warnings.

- [ ] **Step 2: Add shared types and metadata**

In `app/lib/types.ts`, append:

```ts
export type TreeStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface SunshineReceived {
  fromName: string;
  createdAt: string;
}

export interface CheckinStats {
  currentStreak: number;
  weekDots: boolean[];
  totalCheckins: number;
  treeStage: TreeStage;
  toNextStage: number | null;
  fruitCount: number;
  sunshines: SunshineReceived[];
}
```

Create `app/lib/tree.ts`:

```ts
import type { TreeStage } from './types';

export const STAGE_META: Record<TreeStage, { name: string; emoji: string }> = {
  1: { name: 'Seed', emoji: '🌰' },
  2: { name: 'Sprout', emoji: '🌱' },
  3: { name: 'Sapling', emoji: '🌿' },
  4: { name: 'Young Tree', emoji: '🌳' },
  5: { name: 'Full Tree', emoji: '🌳' },
  6: { name: 'Blossoming', emoji: '🌸' },
};

/** Night = 19:00–06:59 local. */
export function isNightAt(hour: number): boolean {
  return hour >= 19 || hour < 7;
}
```

- [ ] **Step 3: Create the palettes**

Create `app/components/tree/palette.ts`:

```ts
import { isNightAt } from '@/lib/tree';

export interface TreePalette {
  night: boolean;
  sky: string;
  celestial: string;      // sun or moon fill
  canopy: string;
  canopySide: string;
  highlight: string;
  trunk: string;
  ground: string;
  blossom: string;
  blossomCenter: string;
  fruit: string;
  text: string;           // primary text over the sky
  textSoft: string;       // secondary text over the sky
}

export const DAY_PALETTE: TreePalette = {
  night: false,
  sky: '#DFF3E7',
  celestial: '#FFE08A',
  canopy: '#2E9E6E',
  canopySide: '#3FB07E',
  highlight: '#57C596',
  trunk: '#8B5E3C',
  ground: '#CDEBD9',
  blossom: '#FFB7C5',
  blossomCenter: '#FFD166',
  fruit: '#F4845F',
  text: '#1A5B3E',
  textSoft: '#4B7A63',
};

export const NIGHT_PALETTE: TreePalette = {
  night: true,
  sky: '#1F3A4D',
  celestial: '#FFE9A8',
  canopy: '#256B4E',
  canopySide: '#2E7D5B',
  highlight: '#3E8E68',
  trunk: '#5E4126',
  ground: '#2C4A3E',
  blossom: '#D98A9C',
  blossomCenter: '#D9B25A',
  fruit: '#C96B4A',
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.75)',
};

export function paletteForDate(d: Date = new Date()): TreePalette {
  return isNightAt(d.getHours()) ? NIGHT_PALETTE : DAY_PALETTE;
}
```

- [ ] **Step 4: Create `TreeFigure`**

Create `app/components/tree/Tree.tsx`:

```tsx
import { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { TreeStage } from '@/lib/types';
import type { TreePalette } from './palette';

interface TreeFigureProps {
  stage: TreeStage;
  fruitCount?: number;
  palette: TreePalette;
}

const BLOSSOM_SPOTS: [number, number][] = [
  [70, 66], [118, 32], [96, 76], [138, 60], [58, 80], [108, 18],
];

const FRUIT_SPOTS: [number, number][] = [
  [80, 52], [124, 44], [98, 88], [142, 76], [64, 94], [112, 60], [88, 30], [132, 92],
];

/**
 * SVG fragment for the tree. Coordinate space: 200×170, trunk base at
 * (100, 160). Embed inside a parent <Svg> via <G transform="...">.
 */
export function TreeFigure({ stage, fruitCount = 0, palette: p }: TreeFigureProps) {
  if (stage === 1) {
    return (
      <G>
        <Path d="M82 160 Q100 144 118 160 Z" fill={p.ground} />
        <Ellipse cx={100} cy={153} rx={6} ry={7} fill={p.trunk} />
      </G>
    );
  }

  if (stage === 2) {
    return (
      <G>
        <Path
          d="M100 160 C100 148 100 140 100 130"
          stroke={p.canopySide} strokeWidth={5} fill="none" strokeLinecap="round"
        />
        <Path d="M100 138 C88 132 82 122 82 112 C94 112 100 122 100 138 Z" fill={p.canopy} />
        <Path d="M100 128 C112 122 118 112 118 102 C106 102 100 112 100 128 Z" fill={p.canopySide} />
      </G>
    );
  }

  if (stage === 3) {
    return (
      <G>
        <Path d="M96 160 L96 108 Q100 100 104 108 L104 160 Z" fill={p.trunk} />
        <Circle cx={100} cy={86} r={30} fill={p.canopy} />
        <Circle cx={88} cy={76} r={9} fill={p.highlight} opacity={0.85} />
      </G>
    );
  }

  if (stage === 4) {
    return (
      <G>
        <Path d="M95 160 L95 96 Q100 86 105 96 L105 160 Z" fill={p.trunk} />
        <Circle cx={68} cy={88} r={22} fill={p.canopySide} />
        <Circle cx={132} cy={88} r={22} fill={p.canopySide} />
        <Circle cx={100} cy={64} r={32} fill={p.canopy} />
        <Circle cx={86} cy={54} r={10} fill={p.highlight} opacity={0.85} />
      </G>
    );
  }

  // Stages 5 and 6 share the full-tree silhouette
  return (
    <G>
      <Path d="M94 160 L94 88 Q100 78 106 88 L106 160 Z" fill={p.trunk} />
      <Path
        d="M100 104 Q84 96 74 82"
        stroke={p.trunk} strokeWidth={8} fill="none" strokeLinecap="round"
      />
      <Path
        d="M100 92 Q116 84 126 70"
        stroke={p.trunk} strokeWidth={8} fill="none" strokeLinecap="round"
      />
      <Circle cx={60} cy={78} r={30} fill={p.canopySide} />
      <Circle cx={140} cy={78} r={30} fill={p.canopySide} />
      <Circle cx={100} cy={52} r={44} fill={p.canopy} />
      <Circle cx={82} cy={38} r={13} fill={p.highlight} opacity={0.85} />
      {stage === 6 &&
        BLOSSOM_SPOTS.map(([x, y], i) => (
          <G key={`b${i}`}>
            <Circle cx={x} cy={y} r={5} fill={p.blossom} />
            <Circle cx={x} cy={y} r={1.8} fill={p.blossomCenter} />
          </G>
        ))}
      {stage === 6 &&
        FRUIT_SPOTS.slice(0, fruitCount).map(([x, y], i) => (
          <Circle key={`f${i}`} cx={x} cy={y} r={4.5} fill={p.fruit} />
        ))}
    </G>
  );
}
```

- [ ] **Step 5: Visually verify all six stages**

Temporarily add to the top of the Home screen body in `app/app/(tabs)/index.tsx`:

```tsx
import Svg, { G as SvgG } from 'react-native-svg';
import { TreeFigure } from '@/components/tree/Tree';
import { DAY_PALETTE, NIGHT_PALETTE } from '@/components/tree/palette';
// inside the ScrollView, temporarily:
<View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#DFF3E7' }}>
  {([1, 2, 3, 4, 5, 6] as const).map((s) => (
    <Svg key={s} width={110} height={95} viewBox="0 0 200 170">
      <TreeFigure stage={s} fruitCount={s === 6 ? 3 : 0} palette={DAY_PALETTE} />
    </Svg>
  ))}
</View>
```

Run: `cd app && npm run start:lan`, open on device/simulator.
Expected: six trees matching the approved mockups (seed mound → blossoming with 3 fruit). Swap `DAY_PALETTE` for `NIGHT_PALETTE` and re-check colors. **Then delete the temporary block and imports.**

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/lib/types.ts app/lib/tree.ts app/components/tree
git commit -m "feat(app): tree SVG figure, palettes, stage metadata"
```

---

### Task 6: App — `TreeScene` (sky, sun/moon, ground, visitors, sunshine, motion)

**Files:**
- Create: `app/components/tree/TreeScene.tsx`

**Interfaces:**
- Consumes: `TreeFigure`, `paletteForDate`, `TreePalette` (Task 5); `SunshineReceived`, `TreeStage` (`@/lib/types`); `react-native-reanimated`.
- Produces (used by Tasks 7, 8):
  ```ts
  interface TreeSceneProps {
    stage: TreeStage;
    fruitCount: number;
    streak: number;
    sunshines: SunshineReceived[];
    size: 'hero' | 'mini';
    celebrate?: boolean;        // one-shot growth celebration when flipped to true
    onTreePress?: () => void;
    accessibilityLabel?: string;
  }
  export function TreeScene(props: TreeSceneProps): JSX.Element
  ```
  `hero`: full-width, 190dp tall, transparent over the hero's sky-colored background; draws sun/moon+stars, ground, swaying tree, bird (streak ≥ 7), butterfly (streak ≥ 30), up to 3 sunshine suns with first names, petal celebration. `mini`: 72×72, rounded, `#E8F5EE` background, tree only, no motion.

- [ ] **Step 1: Create the component**

Create `app/components/tree/TreeScene.tsx`:

```tsx
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { SunshineReceived, TreeStage } from '@/lib/types';
import { TreeFigure } from './Tree';
import { DAY_PALETTE, paletteForDate } from './palette';

interface TreeSceneProps {
  stage: TreeStage;
  fruitCount: number;
  streak: number;
  sunshines: SunshineReceived[];
  size: 'hero' | 'mini';
  celebrate?: boolean;
  onTreePress?: () => void;
  accessibilityLabel?: string;
}

const HERO_HEIGHT = 190;
const PETAL_COUNT = 6;

function firstName(full: string): string {
  return full.split(' ')[0];
}

function SunshineSun({ name, index }: { name: string; index: number }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(index * 250, withSpring(1, { damping: 9 }));
  }, [index, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.sun, { left: 18 + index * 64, top: 6 + (index % 2) * 14 }, style]}>
      <Text style={styles.sunEmoji}>☀️</Text>
      <Text style={styles.sunName}>{name}</Text>
    </Animated.View>
  );
}

function Petal({ index }: { index: number }) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withDelay(
      index * 120,
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) })
    );
  }, [fall, index]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - fall.value,
    transform: [
      { translateY: fall.value * 130 },
      { translateX: Math.sin(index) * 24 * fall.value },
    ],
  }));
  return (
    <Animated.View
      style={[styles.petal, { left: 60 + index * 36, top: 20 + (index % 3) * 10 }, style]}
    />
  );
}

export function TreeScene({
  stage,
  fruitCount,
  streak,
  sunshines,
  size,
  celebrate = false,
  onTreePress,
  accessibilityLabel,
}: TreeSceneProps) {
  const palette = size === 'mini' ? DAY_PALETTE : paletteForDate();

  const sway = useSharedValue(0);
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (size === 'hero') {
      sway.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
          withTiming(-1, { duration: 2600, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
    }
  }, [size, sway]);

  useEffect(() => {
    if (celebrate) {
      bounce.value = withSequence(
        withSpring(1.15, { damping: 5 }),
        withSpring(1, { damping: 8 })
      );
    }
  }, [bounce, celebrate]);

  const treeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value * 1.2}deg` }, { scale: bounce.value }],
  }));

  if (size === 'mini') {
    return (
      <View style={styles.mini} accessibilityLabel={accessibilityLabel}>
        <Svg width={64} height={60} viewBox="0 0 200 190">
          <Ellipse cx={100} cy={172} rx={72} ry={9} fill={palette.ground} />
          <G transform="translate(0, 12)">
            <TreeFigure stage={stage} fruitCount={fruitCount} palette={palette} />
          </G>
        </Svg>
      </View>
    );
  }

  const shownSunshines = sunshines.slice(0, 3);

  return (
    <View
      style={{ height: HERO_HEIGHT, width: '100%' }}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {/* Static layer: celestial + ground */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 210" preserveAspectRatio="xMidYMax meet">
        {palette.night ? (
          <>
            <Path d="M272 26 A17 17 0 1 0 284 54 A13 13 0 0 1 272 26 Z" fill={palette.celestial} />
            <Circle cx={48} cy={30} r={1.8} fill="#FFFFFF" opacity={0.9} />
            <Circle cx={86} cy={16} r={1.4} fill="#FFFFFF" opacity={0.7} />
            <Circle cx={200} cy={22} r={1.6} fill="#FFFFFF" opacity={0.8} />
            <Circle cx={130} cy={34} r={1.2} fill="#FFFFFF" opacity={0.6} />
            <Circle cx={36} cy={70} r={1.4} fill="#FFFFFF" opacity={0.7} />
          </>
        ) : (
          <>
            <Circle cx={276} cy={40} r={15} fill={palette.celestial} />
            <Circle cx={276} cy={40} r={22} fill={palette.celestial} opacity={0.35} />
          </>
        )}
        <Ellipse cx={160} cy={196} rx={122} ry={13} fill={palette.ground} />
      </Svg>

      {/* Animated tree layer */}
      <Animated.View style={[StyleSheet.absoluteFill, treeStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onTreePress}
          disabled={!onTreePress}
          accessibilityRole={onTreePress ? 'button' : undefined}
          accessibilityLabel={onTreePress ? 'Show tree progress' : undefined}
        >
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 210" preserveAspectRatio="xMidYMax meet">
            <G transform="translate(60, 32)">
              <TreeFigure stage={stage} fruitCount={fruitCount} palette={palette} />
            </G>
            {streak >= 7 && (
              <G transform="translate(208, 62)">
                <Ellipse cx={0} cy={0} rx={8} ry={6} fill="#F4845F" />
                <Circle cx={6} cy={-4} r={4.5} fill="#F4845F" />
                <Circle cx={7.5} cy={-5} r={1} fill="#1A1A1A" />
                <Path d="M10 -3.5 L15 -2.5 L10 -1.5 Z" fill="#FFD166" />
              </G>
            )}
            {streak >= 30 && (
              <G transform="translate(92, 48)">
                <Ellipse cx={-3} cy={0} rx={4} ry={6} fill={palette.blossom} transform="rotate(-24)" />
                <Ellipse cx={3} cy={0} rx={4} ry={6} fill={palette.blossom} transform="rotate(24)" />
                <Ellipse cx={0} cy={1} rx={1.4} ry={4.5} fill="#1A1A1A" opacity={0.7} />
              </G>
            )}
          </Svg>
        </Pressable>
      </Animated.View>

      {/* Sunshine suns from the circle */}
      {shownSunshines.map((s, i) => (
        <SunshineSun key={`${s.fromName}-${s.createdAt}`} name={firstName(s.fromName)} index={i} />
      ))}

      {/* One-shot petal celebration */}
      {celebrate &&
        Array.from({ length: PETAL_COUNT }, (_, i) => <Petal key={i} index={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  mini: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sun: {
    position: 'absolute',
    alignItems: 'center',
  },
  sunEmoji: { fontSize: 18 },
  sunName: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  petal: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFB7C5',
  },
});
```

- [ ] **Step 2: Visually verify**

Temporarily render in the Home screen ScrollView:

```tsx
<View style={{ backgroundColor: '#DFF3E7' }}>
  <TreeScene stage={5} fruitCount={0} streak={8}
    sunshines={[{ fromName: 'Sarah Lee', createdAt: new Date().toISOString() }]}
    size="hero" celebrate />
</View>
```

Expected: swaying full tree over ground, sun (or moon+stars after 19:00 device time), a bird on the right, one popping-in "☀️ Sarah" sun, pink petals falling once. Also render `size="mini"` with `stage={3}` — 72×72 rounded thumbnail, no motion. **Delete the temporary block.**

- [ ] **Step 3: Commit**

```bash
git add app/components/tree/TreeScene.tsx
git commit -m "feat(app): TreeScene with day/night sky, visitors, sunshine, motion"
```

---

### Task 7: App — Home hero integration

**Files:**
- Modify: `app/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `TreeScene` (Task 6), `CheckinStats`/`SunshineReceived`/`TreeStage` types (Task 5), `STAGE_META` (Task 5), `paletteForDate` (Task 5), extended `/checkins/stats` (Task 2), `getUserId` from `@/lib/auth`, `AsyncStorage`.
- Produces: the finished Home screen. AsyncStorage keys (also read by no one else — internal): `tree_stage_<userId>` (last-seen stage, string int), `tree_cache_<userId>` (JSON `CheckinStats`), `sunshine_seen_<userId>` (ISO timestamp).

- [ ] **Step 1: Rework the Home screen**

In `app/app/(tabs)/index.tsx`:

Add imports:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserId } from '@/lib/auth';
import { STAGE_META } from '@/lib/tree';
import { TreeScene } from '@/components/tree/TreeScene';
import { paletteForDate } from '@/components/tree/palette';
import type { Checkin, CheckinStats } from '@/lib/types';
```

Replace the `latest/streak/weekDots` state with a single stats state plus tree UI state:

```tsx
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [sunshineBanner, setSunshineBanner] = useState<string | null>(null);
```

Delete the old `const [streak, setStreak]` and `const [weekDots, setWeekDots]` declarations (`latest`, `userName`, `checkinTimes`, `heroExpanded` stay). Add one ref next to the state:

```tsx
  const hydratedRef = useRef(false);
```

(add `useRef` to the existing React import). Inside the `useFocusEffect` loader, replace the stats handling:

```tsx
          const uid = await getUserId();

          // Hydrate from cache once so the tree never flashes back to seed
          if (uid && !hydratedRef.current) {
            hydratedRef.current = true;
            const cached = await AsyncStorage.getItem(`tree_cache_${uid}`);
            if (cached && !cancelled) {
              try { setStats(JSON.parse(cached) as CheckinStats); } catch {}
            }
          }

          const [me, last, freshStats] = await Promise.all([
            apiRequest<Me>('/auth/me'),
            apiRequest<Checkin | null>('/checkins/latest'),
            apiRequest<CheckinStats>('/checkins/stats'),
          ]);
          if (cancelled) return;
          setUserName(me.fullName || '');
          setCheckinTimes(me.checkinTimes ?? []);
          setLatest(last);
          setStats(freshStats);

          if (uid) {
            await AsyncStorage.setItem(`tree_cache_${uid}`, JSON.stringify(freshStats));

            // Growth celebration: stage increased since last seen
            const storedStage = await AsyncStorage.getItem(`tree_stage_${uid}`);
            if (storedStage && freshStats.treeStage > parseInt(storedStage, 10)) {
              setCelebrate(true);
            }
            await AsyncStorage.setItem(`tree_stage_${uid}`, String(freshStats.treeStage));

            // Sunshine banner: anything newer than last seen
            const seen = (await AsyncStorage.getItem(`sunshine_seen_${uid}`)) ?? '';
            const fresh = freshStats.sunshines.find((s) => s.createdAt > seen);
            if (fresh) {
              setSunshineBanner(fresh.fromName.split(' ')[0]);
              await AsyncStorage.setItem(
                `sunshine_seen_${uid}`,
                freshStats.sunshines[0].createdAt
              );
            } else {
              setSunshineBanner(null);
            }
          }
```

Rework the hero JSX. The hero stops being one big Pressable — collapse moves to the chevron, the tree handles its own tap:

```tsx
        {(() => {
          const pal = paletteForDate();
          const streak = stats?.currentStreak ?? 0;
          const weekDots = stats?.weekDots ?? [];
          return (
            <View style={[styles.hero, heroExpanded && { backgroundColor: pal.sky }]}>
              {heroExpanded ? (
                <>
                  <View style={styles.heroTop}>
                    <View>
                      <Text style={[styles.dateText, { color: pal.textSoft }]}>{dateString}</Text>
                      <Text style={[styles.greeting, { color: pal.text }]}>{greeting},</Text>
                      <Text style={[styles.name, { color: pal.text }]}>{userName || 'Friend'} 👋</Text>
                    </View>
                    <View style={styles.avatarCircle}>
                      <FontAwesome name="user" size={28} color={theme.primary} />
                    </View>
                  </View>

                  {sunshineBanner && (
                    <View style={styles.sunshineBanner}>
                      <Text style={styles.sunshineBannerText}>
                        ☀️ {sunshineBanner} sent you sunshine
                      </Text>
                    </View>
                  )}

                  <TreeScene
                    stage={stats?.treeStage ?? 1}
                    fruitCount={stats?.fruitCount ?? 0}
                    streak={streak}
                    sunshines={stats?.sunshines ?? []}
                    size="hero"
                    celebrate={celebrate}
                    onTreePress={() => setShowProgress((v) => !v)}
                    accessibilityLabel={`Your tree: ${STAGE_META[stats?.treeStage ?? 1].name}, ${stats?.totalCheckins ?? 0} check-ins, ${streak}-day streak`}
                  />

                  {stats?.totalCheckins === 0 ? (
                    <Text style={[styles.treeHint, { color: pal.textSoft }]}>
                      Your tree is waiting for its first check-in 🌱
                    </Text>
                  ) : showProgress && stats ? (
                    <Text style={[styles.treeHint, { color: pal.textSoft }]}>
                      {STAGE_META[stats.treeStage].emoji} {STAGE_META[stats.treeStage].name} · {stats.totalCheckins} check-ins
                      {stats.toNextStage !== null
                        ? ` · ${stats.toNextStage} more to ${STAGE_META[(stats.treeStage + 1) as CheckinStats['treeStage']].name}`
                        : ''}
                    </Text>
                  ) : null}

                  {weekDots.length === 7 && (
                    <View style={styles.consistencyRow}>
                      <View style={styles.dotsRow}>
                        {weekDots.map((filled, i) => (
                          <View
                            key={i}
                            style={[
                              styles.dot,
                              filled
                                ? { backgroundColor: pal.night ? '#FFFFFF' : theme.primary }
                                : { borderWidth: 1.5, borderColor: pal.textSoft },
                            ]}
                          />
                        ))}
                      </View>
                      {streak > 0 && (
                        <Text style={[styles.streakText, { color: pal.text }]}>
                          🔥 {streak} day{streak !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.heroCompact}>
                  <Text style={styles.heroCompactName}>{greeting}, {userName || 'Friend'} 👋</Text>
                  {streak > 0 && <Text style={styles.streakText}>🔥 {streak}</Text>}
                </View>
              )}
              <Pressable
                style={styles.heroChevron}
                onPress={toggleHero}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={heroExpanded ? 'Collapse header' : 'Expand header'}
              >
                <FontAwesome
                  name={heroExpanded ? 'chevron-up' : 'chevron-down'}
                  size={11}
                  color={heroExpanded ? paletteForDate().textSoft : 'rgba(255,255,255,0.6)'}
                />
              </Pressable>
            </View>
          );
        })()}
```

Style changes in the StyleSheet:
- `hero`: keep as-is (collapsed state keeps `theme.primary` background; expanded overrides with sky color as above).
- `dotFilled` / `dotEmpty` entries can be removed (colors now inline).
- Add:

```tsx
  sunshineBanner: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
  },
  sunshineBannerText: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  treeHint: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6 },
```

No other code in the file reads `streak`/`weekDots` outside the hero block above, so the deleted state has no remaining references.

- [ ] **Step 2: Verify**

Run: `cd app && npm run start:lan` with the server running.
Checklist:
- Hero shows sky-colored scene, greeting readable (dark green by day, white at night — flip device clock past 19:00 to confirm).
- Tap tree → progress line toggles; tap chevron → collapses to the compact green bar.
- Account with 0 check-ins shows seed + waiting line.
- With a sunshine sent from another account (Task 3 curl works): banner + named sun appear; kill and reopen the app → no seed flash (cache hydration); banner does not reappear on next focus.
- Celebration: run `AsyncStorage.setItem('tree_stage_<uid>', '1')` temporarily (or check in past a threshold) → bounce + petals fire once.

- [ ] **Step 3: Commit**

```bash
git add app/app/\(tabs\)/index.tsx
git commit -m "feat(app): living tree hero on Home with celebration, cache, sunshine banner"
```

---

### Task 8: App — Circle cards: mini tree, stage line, Send Sunshine

**Files:**
- Modify: `app/lib/types.ts` (extend `CircleMember`)
- Modify: `app/components/WatchingList.tsx`

**Interfaces:**
- Consumes: `TreeScene` mini (Task 6), `STAGE_META` (Task 5), extended `GET /circle` (Task 4), `POST /circle/:userId/sunshine` (Task 3), `apiRequest` (`{ method: 'POST' }`), `ApiError` from `@/lib/api`.
- Produces: finished Circle "Watching" tab.

- [ ] **Step 1: Extend the type**

In `app/lib/types.ts`, change `CircleMember` to:

```ts
export interface CircleMember {
  _id: string;
  fullName: string;
  latestCheckin: Checkin | null;
  treeStage: TreeStage;
  currentStreak: number;
}
```

- [ ] **Step 2: Update the card**

In `app/components/WatchingList.tsx`:

Add imports:

```tsx
import { Alert } from 'react-native';
import { ApiError, apiRequest } from '@/lib/api';   // apiRequest already imported — extend the line
import { STAGE_META } from '@/lib/tree';
import { TreeScene } from '@/components/tree/TreeScene';
```

Add state + handler inside `WatchingList`:

```tsx
  const [sunshineSent, setSunshineSent] = useState<Set<string>>(new Set());

  const sendSunshine = useCallback(async (member: CircleMember) => {
    try {
      await apiRequest(`/circle/${member._id}/sunshine`, { method: 'POST' });
      setSunshineSent((prev) => new Set(prev).add(member._id));
      Alert.alert('Sunshine sent ☀️', `${member.fullName.split(' ')[0]} will see it on their tree.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSunshineSent((prev) => new Set(prev).add(member._id));
        Alert.alert('Already sent ☀️', 'You can send sunshine once a day per person.');
      } else {
        Alert.alert('Could not send', 'Please check your connection and try again.');
      }
    }
  }, []);
```

In `renderItem`, replace the initials avatar `<View style={styles.avatar}>…</View>` with:

```tsx
            <TreeScene
              stage={item.treeStage}
              fruitCount={0}
              streak={item.currentStreak}
              sunshines={[]}
              size="mini"
              accessibilityLabel={`${item.fullName}'s tree: ${STAGE_META[item.treeStage].name}`}
            />
```

(The `initials` computation becomes unused — delete it.)

Under the check-in status block (after `checkinTime` / `noCheckin`), add the stage line:

```tsx
              <Text style={styles.stageLine}>
                {STAGE_META[item.treeStage].emoji} {STAGE_META[item.treeStage].name}
                {item.currentStreak > 0 ? ` · ${item.currentStreak}-day streak` : ''}
              </Text>
```

In the non-editing right column, stack the sunshine button under the traffic light — replace the lone traffic-light `<View>` with:

```tsx
              <View style={styles.rightCol}>
                <View
                  style={[
                    styles.trafficLight,
                    { backgroundColor: worst ? STATUS_META[worst].bgColor : '#E5E7EB' },
                  ]}>
                  <Text style={styles.trafficLightEmoji}>
                    {worst ? STATUS_META[worst].emoji : '💤'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.sunshineBtn, sunshineSent.has(item._id) && styles.sunshineBtnSent]}
                  disabled={sunshineSent.has(item._id)}
                  onPress={() => sendSunshine(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Send sunshine to ${item.fullName}`}>
                  <Text style={styles.sunshineBtnEmoji}>☀️</Text>
                </Pressable>
              </View>
```

Add styles (and remove the now-unused `avatar`/`avatarText`):

```tsx
  rightCol: { gap: 8, alignItems: 'center' },
  stageLine: { fontSize: 13, fontWeight: '600', color: theme.primary },
  sunshineBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF3D6',
    borderWidth: 2,
    borderColor: '#FFD166',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunshineBtnSent: { opacity: 0.4 },
  sunshineBtnEmoji: { fontSize: 20 },
```

- [ ] **Step 3: Verify**

With two linked accounts on the running stack:
- B's Watching tab shows A's card with mini tree at the right stage, stage line ("🌿 Sapling · 3-day streak"), traffic light, and ☀️ button.
- Tap ☀️ → success alert, button dims and disables; A's device gets the push and the sun appears on A's Home tree.
- Tap again after reload → 409 path shows "Already sent" and re-disables.
- Editing mode still shows the reorder arrows in place of the right column.

- [ ] **Step 4: Commit**

```bash
git add app/lib/types.ts app/components/WatchingList.tsx
git commit -m "feat(app): mini trees + send sunshine on circle cards"
```

---

### Task 9: Docs + end-to-end pass

**Files:**
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: everything above.
- Produces: updated docs; verified feature.

- [ ] **Step 1: Update architecture docs**

In `docs/architecture.md`, add to the schema section:

```markdown
- **sunshines** — `id, from_user_id, to_user_id, created_at`. A "sunshine" reaction from a circle member to a sender. Max one per pair per rolling 20h (enforced in API).
```

and to the API section:

```markdown
- `GET /api/checkins/stats` — also returns `totalCheckins`, `treeStage` (1–6), `toNextStage`, `fruitCount`, `sunshines` (last 48h). Tree stage thresholds: 0/5/25/60/120/200 lifetime check-ins.
- `GET /api/circle` — each member includes `treeStage` and `currentStreak`.
- `POST /api/circle/:userId/sunshine` — send sunshine; 404 if not an active circle link, 409 (`nextAllowedAt`) inside the 20h cooldown; pushes "{First name} sent you sunshine ☀️" to the recipient.
```

- [ ] **Step 2: Full end-to-end pass**

Run `cd server && npm run build && npm test` — clean. Then with the app on two devices/accounts:

1. Fresh account: Home shows seed + "waiting for its first check-in".
2. Check in → tree data updates; at 5 total check-ins the sprout appears with bounce + petals (seed the account or temporarily lower `tree_stage_<uid>` in AsyncStorage to force the celebration path).
3. Device clock at 20:00 → night sky, moon, stars, readable white text; back to 10:00 → day.
4. Streak ≥ 7 account shows the bird.
5. B sends sunshine → A gets push, banner, named sun; B's button disables; immediate resend → friendly "already sent".
6. Kill/reopen app offline (airplane mode) → cached tree renders, no seed flash.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: tree companion schema + API notes"
```
