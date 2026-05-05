# Navigation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the app from 7 bottom tabs to 4 (Home · Circle · History · Settings), merging Contacts into Circle as a segmented sub-tab, merging Alerts into History, and moving Check-In access to a Home FAB.

**Architecture:** Backend gains a `sort_order` column on `contacts` for persistent contact ordering. Two new components (`WatchingList`, `MyContactsList`) are extracted from the existing `circle.tsx` and `contacts.tsx` screens. The `circle.tsx` screen becomes a thin segmented-control shell that composes them. `history.tsx` gains an Alerts section at the top rendered as a `ListHeaderComponent`.

**Tech Stack:** React Native + Expo Router, TypeScript, Supabase (Postgres), Express, `@react-native-async-storage/async-storage`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `server/src/db/types.ts` | Add `sort_order` to `ContactRow` |
| Modify | `server/src/db/mappers.ts` | Map `sort_order → sortOrder` in `mapContact` |
| Modify | `server/src/routes/contacts.ts` | GET orders by sort_order; POST assigns next; PUT accepts sortOrder |
| Modify | `app/lib/types.ts` | Add `sortOrder: number` to `Contact` |
| Modify | `app/app/(tabs)/_layout.tsx` | Remove Check-In, Alerts, Contacts tabs |
| Modify | `app/app/(tabs)/index.tsx` | Add FAB |
| Create | `app/components/WatchingList.tsx` | Receiver dashboard list + AsyncStorage order + edit mode |
| Create | `app/components/MyContactsList.tsx` | Contacts management list + sort_order API + edit mode |
| Modify | `app/app/(tabs)/circle.tsx` | Segmented control composing WatchingList + MyContactsList |
| Modify | `app/app/(tabs)/history.tsx` | Alerts section as ListHeaderComponent |
| Delete | `app/app/(tabs)/alerts.tsx` | Absorbed into history.tsx |
| Delete | `app/app/(tabs)/contacts.tsx` | Absorbed into MyContactsList.tsx |

---

## Task 1: DB Migration — Add sort_order to contacts

**Files:** Supabase SQL editor (no file to commit)

- [ ] **Step 1: Run migration in Supabase SQL editor**

Open your Supabase project → SQL editor → run:

```sql
ALTER TABLE contacts ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

UPDATE contacts c
SET sort_order = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
  FROM contacts
) sub
WHERE c.id = sub.id;
```

- [ ] **Step 2: Verify**

In Supabase Table Editor → contacts table, confirm the `sort_order` column exists and each row has a non-negative integer value that is unique within its `user_id` group.

---

## Task 2: Update Backend Types and Mapper

**Files:**
- Modify: `server/src/db/types.ts`
- Modify: `server/src/db/mappers.ts`

- [ ] **Step 1: Add sort_order to ContactRow**

In `server/src/db/types.ts`, add to the `ContactRow` interface:

```typescript
export interface ContactRow {
  id: string;
  user_id: string;
  contact_user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  notify_on_help: boolean;
  notify_on_missed: boolean;
  notify_on_decline: boolean;
  is_emergency: boolean;
  sort_order: number;        // ← add this line
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Map sort_order in mapContact**

In `server/src/db/mappers.ts`, update `mapContact`:

```typescript
export function mapContact(row: ContactRow) {
  return {
    _id: row.id,
    userId: row.user_id,
    contactUserId: row.contact_user_id ?? undefined,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    relationship: row.relationship ?? undefined,
    notifyOnHelp: row.notify_on_help,
    notifyOnMissed: row.notify_on_missed,
    notifyOnDecline: row.notify_on_decline,
    isEmergency: row.is_emergency,
    sortOrder: row.sort_order,             // ← add this line
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd server && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/types.ts server/src/db/mappers.ts
git commit -m "feat: add sort_order to ContactRow and mapContact"
```

---

## Task 3: Update Contacts Route

**Files:**
- Modify: `server/src/routes/contacts.ts`

- [ ] **Step 1: Update GET to order by sort_order**

Replace the `.order` call in the `GET /` handler:

```typescript
// Before
.order('created_at', { ascending: false });

// After
.order('sort_order', { ascending: true });
```

- [ ] **Step 2: Add sortOrder to FIELD_MAP for PUT**

In the `FIELD_MAP` object at the top of the file, add:

```typescript
const FIELD_MAP: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  relationship: 'relationship',
  notifyOnHelp: 'notify_on_help',
  notifyOnMissed: 'notify_on_missed',
  notifyOnDecline: 'notify_on_decline',
  isEmergency: 'is_emergency',
  sortOrder: 'sort_order',    // ← add this line
};
```

- [ ] **Step 3: Auto-assign sort_order on POST**

In the `POST /` handler, add this block before the `insert` is built, after `lookupContactUserId`:

```typescript
// Get the next sort_order for this user (new contacts go to the bottom)
const { data: maxRow } = await db()
  .from('contacts')
  .select('sort_order')
  .eq('user_id', req.userId!)
  .order('sort_order', { ascending: false })
  .limit(1)
  .maybeSingle();

const nextSortOrder = maxRow
  ? (maxRow as { sort_order: number }).sort_order + 1
  : 0;

const insert: Record<string, unknown> = {
  user_id: req.userId!,
  name: req.body.name,
  contact_user_id: contactUserId,
  sort_order: nextSortOrder,   // ← include in insert object
};
```

- [ ] **Step 4: Build to verify**

```bash
cd server && npm run build
```

Expected: no errors.

- [ ] **Step 5: Manual test — GET returns contacts in sort_order**

With the dev server running (`npm run dev`), use a valid JWT:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/contacts
```

Expected: contacts array ordered by `sortOrder` ascending (0, 1, 2...).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/contacts.ts
git commit -m "feat: contacts ordered by sort_order; auto-assign on create; accept sortOrder on update"
```

---

## Task 4: Update Frontend Contact Type

**Files:**
- Modify: `app/lib/types.ts`

- [ ] **Step 1: Add sortOrder to Contact**

```typescript
export interface Contact {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  relationship?: string;
  contactUserId?: string;
  notifyOnHelp: boolean;
  notifyOnMissed: boolean;
  notifyOnDecline: boolean;
  isEmergency: boolean;
  sortOrder: number;          // ← add this line
  createdAt: string;
}
```

- [ ] **Step 2: Build to check no type errors**

```bash
cd app && npx tsc --noEmit
```

Expected: no new errors (existing contacts.tsx will show errors until Task 9 — that's expected; fix in later tasks).

- [ ] **Step 3: Commit**

```bash
git add app/lib/types.ts
git commit -m "feat: add sortOrder to Contact type"
```

---

## Task 5: Install AsyncStorage

**Files:** `app/package.json` (updated by install)

- [ ] **Step 1: Install the package**

```bash
cd app && npx expo install @react-native-async-storage/async-storage
```

Expected: package added to `app/package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: add @react-native-async-storage/async-storage"
```

---

## Task 6: Slim Tab Layout to 4 Tabs

**Files:**
- Modify: `app/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace _layout.tsx content**

```typescript
import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import Colors from '@/constants/Colors';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          height: 85,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="circle"
        options={{
          title: 'Circle',
          tabBarIcon: ({ color }) => <TabBarIcon name="heart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
```

Note: `fontSize` increased from 11 to 13 — 4 tabs gives more label space.

- [ ] **Step 2: Start the app and verify**

```bash
cd app && npm start
```

Expected: bottom tab bar shows exactly 4 tabs — Home, Circle, History, Settings.

- [ ] **Step 3: Commit**

```bash
git add app/app/(tabs)/_layout.tsx
git commit -m "feat: slim tab bar from 7 to 4 tabs"
```

---

## Task 7: Add FAB to Home Screen

**Files:**
- Modify: `app/app/(tabs)/index.tsx`

- [ ] **Step 1: Wrap layout in a relative View and add FAB**

The `SafeAreaView` already has `flex: 1`. Add a `Pressable` FAB after the `ScrollView`, positioned absolutely. Replace the entire return statement:

```tsx
return (
  <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Green hero header */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.dateText}>{dateString}</Text>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{userName || 'Friend'} 👋</Text>
          </View>
          <View style={styles.avatarCircle}>
            <FontAwesome name="user" size={28} color={theme.primary} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {todaysCheckin ? (
          <View style={styles.statusCard}>
            <Text style={styles.cardLabel}>Today's last check-in</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_META[todaysCheckin.physicalStatus].bgColor }]}>
                <Text style={styles.statusBadgeEmoji}>{STATUS_META[todaysCheckin.physicalStatus].emoji}</Text>
                <Text style={[styles.statusBadgeText, { color: STATUS_META[todaysCheckin.physicalStatus].color }]}>
                  {STATUS_META[todaysCheckin.physicalStatus].short}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_META[todaysCheckin.mentalStatus].bgColor }]}>
                <Text style={styles.statusBadgeEmoji}>{STATUS_META[todaysCheckin.mentalStatus].emoji}</Text>
                <Text style={[styles.statusBadgeText, { color: STATUS_META[todaysCheckin.mentalStatus].color }]}>
                  {STATUS_META[todaysCheckin.mentalStatus].short}
                </Text>
              </View>
              <Text style={styles.checkinTime}>
                {new Date(todaysCheckin.createdAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.statusCard}>
            <Text style={styles.cardLabel}>No check-ins yet today</Text>
            <Text style={styles.cardSubtext}>Tap below to share how you're feeling</Text>
          </View>
        )}

        <View style={styles.ctaCard}>
          <FontAwesome name="heartbeat" size={44} color={theme.primary} />
          <Text style={styles.ctaTitle}>How are you feeling?</Text>
          <Text style={styles.ctaSubtext}>
            It only takes a few seconds to let your loved ones know.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Start check-in"
            onPress={() => router.push('/checkin')}>
            <Text style={styles.ctaButtonText}>Start Check-In</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>

    {/* Floating action button — secondary shortcut to check-in */}
    <Pressable
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel="Quick check-in"
      onPress={() => router.push('/checkin')}>
      <Text style={styles.fabIcon}>+</Text>
    </Pressable>
  </SafeAreaView>
);
```

- [ ] **Step 2: Add FAB styles**

Add to the `StyleSheet.create({})` block in `index.tsx`:

```typescript
fab: {
  position: 'absolute',
  bottom: 24,
  right: 24,
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: theme.cta,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
  elevation: 6,
},
fabIcon: {
  color: '#FFFFFF',
  fontSize: 30,
  fontWeight: '300',
  lineHeight: 34,
},
```

- [ ] **Step 3: Test manually**

Run the app. On the Home screen, verify:
- Coral `+` FAB appears bottom-right, above the tab bar
- Tapping FAB navigates to the Check-In screen
- Tapping the "Start Check-In" card button also navigates to Check-In

- [ ] **Step 4: Commit**

```bash
git add app/app/(tabs)/index.tsx
git commit -m "feat: add FAB shortcut to check-in on Home screen"
```

---

## Task 8: Create WatchingList Component

**Files:**
- Create: `app/components/WatchingList.tsx`

- [ ] **Step 1: Create the file**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import { STATUS_META } from '@/lib/status';
import type { CircleMember } from '@/lib/types';

const ORDER_KEY = 'watching_order';
const STATUS_PRIORITY = ['need_help', 'not_great', 'okay', 'great'];

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function loadSavedOrder(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function persistOrder(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

function applyOrder(members: CircleMember[], order: string[]): CircleMember[] {
  if (order.length === 0) return members;
  const map = new Map(members.map((m) => [m._id, m]));
  const sorted: CircleMember[] = [];
  for (const id of order) {
    if (map.has(id)) sorted.push(map.get(id)!);
  }
  // Append members not yet in saved order (newly added senders)
  for (const m of members) {
    if (!order.includes(m._id)) sorted.push(m);
  }
  return sorted;
}

interface Props {
  editing: boolean;
}

export function WatchingList({ editing }: Props) {
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, savedOrder] = await Promise.all([
        apiRequest<CircleMember[]>('/circle'),
        loadSavedOrder(),
      ]);
      setMembers(applyOrder(res, savedOrder));
    } catch {
      // Silent — auth guard handles 401s
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const move = useCallback(async (index: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    const next = [...members];
    [next[index], next[toIndex]] = [next[toIndex], next[index]];
    const newOrder = next.map((m) => m._id);
    setMembers(next);
    await persistOrder(newOrder);
  }, [members]);

  if (loaded && members.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyEmoji}>🤝</Text>
        <Text style={styles.emptyTitle}>Your circle is empty</Text>
        <Text style={styles.emptySubtext}>
          When someone adds you as a contact using your Sihaty email, they'll appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={members}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
      renderItem={({ item, index }) => {
        const checkin = item.latestCheckin;
        const todayCheckin = checkin && isToday(checkin.createdAt) ? checkin : null;
        const worst = todayCheckin
          ? (STATUS_PRIORITY.find(
              (s) => s === todayCheckin.physicalStatus || s === todayCheckin.mentalStatus
            ) as typeof todayCheckin.physicalStatus)
          : null;

        const initials = item.fullName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.memberName}>{item.fullName}</Text>
              {todayCheckin && worst ? (
                <>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_META[todayCheckin.physicalStatus].bgColor }]}>
                      <Text style={styles.statusPillEmoji}>{STATUS_META[todayCheckin.physicalStatus].emoji}</Text>
                      <Text style={[styles.statusPillText, { color: STATUS_META[todayCheckin.physicalStatus].color }]}>Body</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_META[todayCheckin.mentalStatus].bgColor }]}>
                      <Text style={styles.statusPillEmoji}>{STATUS_META[todayCheckin.mentalStatus].emoji}</Text>
                      <Text style={[styles.statusPillText, { color: STATUS_META[todayCheckin.mentalStatus].color }]}>Mind</Text>
                    </View>
                  </View>
                  <Text style={styles.checkinTime}>Checked in {relativeTime(todayCheckin.createdAt)}</Text>
                </>
              ) : (
                <Text style={styles.noCheckin}>No check-in today</Text>
              )}
            </View>
            {editing ? (
              <View style={styles.arrowBtns}>
                <Pressable
                  style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                  disabled={index === 0}
                  onPress={() => move(index, 'up')}
                  hitSlop={6}>
                  <FontAwesome
                    name="chevron-up"
                    size={13}
                    color={index === 0 ? '#D1D5DB' : theme.textPrimary}
                  />
                </Pressable>
                <Pressable
                  style={[styles.arrowBtn, index === members.length - 1 && styles.arrowBtnDisabled]}
                  disabled={index === members.length - 1}
                  onPress={() => move(index, 'down')}
                  hitSlop={6}>
                  <FontAwesome
                    name="chevron-down"
                    size={13}
                    color={index === members.length - 1 ? '#D1D5DB' : theme.textPrimary}
                  />
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.trafficLight,
                  { backgroundColor: worst ? STATUS_META[worst].bgColor : '#E5E7EB' },
                ]}>
                <Text style={styles.trafficLightEmoji}>
                  {worst ? STATUS_META[worst].emoji : '💤'}
                </Text>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: theme.primary },
  cardBody: { flex: 1, gap: 6 },
  memberName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  statusRow: { flexDirection: 'row', gap: 6 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusPillEmoji: { fontSize: 14 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  checkinTime: { fontSize: 13, color: theme.textSecondary },
  noCheckin: { fontSize: 14, color: theme.textSecondary, fontStyle: 'italic' },
  trafficLight: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trafficLightEmoji: { fontSize: 22 },
  arrowBtns: { gap: 4 },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: { backgroundColor: '#F9FAFB' },
  emptyCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingBottom: 100,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptySubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
```

- [ ] **Step 2: Build check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add app/components/WatchingList.tsx
git commit -m "feat: WatchingList component with edit-order mode and AsyncStorage sort"
```

---

## Task 9: Create MyContactsList Component

**Files:**
- Create: `app/components/MyContactsList.tsx`

- [ ] **Step 1: Create the file**

This is the content of the old `contacts.tsx` screen plus ▲▼ reordering via the API:

```typescript
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/Colors';
import { apiRequest, ApiError } from '@/lib/api';
import type { Contact } from '@/lib/types';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  relationship: '',
  isEmergency: false,
  notifyOnHelp: true,
  notifyOnMissed: true,
  notifyOnDecline: false,
};

interface Props {
  editing: boolean;
}

export function MyContactsList({ editing }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<Contact[]>('/contacts');
      setContacts(res);
    } catch {
      // Silent
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openAdd = () => {
    setEditingContact(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalVisible(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      relationship: contact.relationship ?? '',
      isEmergency: contact.isEmergency,
      notifyOnHelp: contact.notifyOnHelp,
      notifyOnMissed: contact.notifyOnMissed,
      notifyOnDecline: contact.notifyOnDecline,
    });
    setFormError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    setFormError('');
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        relationship: form.relationship.trim() || undefined,
        isEmergency: form.isEmergency,
        notifyOnHelp: form.notifyOnHelp,
        notifyOnMissed: form.notifyOnMissed,
        notifyOnDecline: form.notifyOnDecline,
      };
      if (editingContact) {
        await apiRequest(`/contacts/${editingContact._id}`, { method: 'PUT', body });
      } else {
        await apiRequest('/contacts', { method: 'POST', body });
      }
      setModalVisible(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (contact: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Remove ${contact.name} from your trusted contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/contacts/${contact._id}`, { method: 'DELETE' });
              await load();
            } catch { /* Silent */ }
          },
        },
      ]
    );
  };

  const move = useCallback(async (index: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    const next = [...contacts];
    const fromSortOrder = next[index].sortOrder;
    const toSortOrder = next[toIndex].sortOrder;
    const updatedFrom = { ...next[index], sortOrder: toSortOrder };
    const updatedTo = { ...next[toIndex], sortOrder: fromSortOrder };
    next[index] = updatedTo;
    next[toIndex] = updatedFrom;
    setContacts(next);
    await Promise.all([
      apiRequest(`/contacts/${updatedFrom._id}`, { method: 'PUT', body: { sortOrder: updatedFrom.sortOrder } }),
      apiRequest(`/contacts/${updatedTo._id}`, { method: 'PUT', body: { sortOrder: updatedTo.sortOrder } }),
    ]);
  }, [contacts]);

  const updateField = (key: keyof typeof EMPTY_FORM, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loaded && contacts.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
        <Text style={styles.emptyTitle}>No contacts yet</Text>
        <Text style={styles.emptySubtext}>
          Add family or trusted people who should be notified about your well-being
        </Text>
        <Pressable style={styles.addFirstBtn} onPress={openAdd}>
          <Text style={styles.addFirstBtnText}>+ Add First Contact</Text>
        </Pressable>
        <ContactModal
          visible={modalVisible}
          editing={editingContact}
          form={form}
          saving={saving}
          formError={formError}
          updateField={updateField}
          onSave={handleSave}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {item.isEmergency && (
                    <View style={styles.emergencyBadge}>
                      <Text style={styles.emergencyText}>Emergency</Text>
                    </View>
                  )}
                  {item.contactUserId && (
                    <View style={styles.sihatyBadge}>
                      <FontAwesome name="check-circle" size={11} color={theme.primary} />
                      <Text style={styles.sihatyBadgeText}>Sihaty</Text>
                    </View>
                  )}
                </View>
                {item.relationship ? <Text style={styles.cardRelationship}>{item.relationship}</Text> : null}
                {item.phone ? <Text style={styles.cardDetail}>{item.phone}</Text> : null}
              </View>
              {editing ? (
                <View style={styles.arrowBtns}>
                  <Pressable
                    style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                    disabled={index === 0}
                    onPress={() => move(index, 'up')}
                    hitSlop={6}>
                    <FontAwesome name="chevron-up" size={13} color={index === 0 ? '#D1D5DB' : theme.textPrimary} />
                  </Pressable>
                  <Pressable
                    style={[styles.arrowBtn, index === contacts.length - 1 && styles.arrowBtnDisabled]}
                    disabled={index === contacts.length - 1}
                    onPress={() => move(index, 'down')}
                    hitSlop={6}>
                    <FontAwesome name="chevron-down" size={13} color={index === contacts.length - 1 ? '#D1D5DB' : theme.textPrimary} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.cardActions}>
                  <Pressable style={styles.actionButton} onPress={() => openEdit(item)} hitSlop={8}>
                    <FontAwesome name="pencil" size={18} color={theme.primary} />
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => handleDelete(item)} hitSlop={8}>
                    <FontAwesome name="trash" size={18} color={theme.danger} />
                  </Pressable>
                </View>
              )}
            </View>
            {!editing && (
              <View style={styles.notifyRow}>
                {item.notifyOnHelp && <View style={styles.notifyChip}><Text style={styles.notifyChipText}>Help</Text></View>}
                {item.notifyOnMissed && <View style={styles.notifyChip}><Text style={styles.notifyChipText}>Missed</Text></View>}
                {item.notifyOnDecline && <View style={styles.notifyChip}><Text style={styles.notifyChipText}>Decline</Text></View>}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          !editing ? (
            <Pressable style={styles.addBtn} onPress={openAdd}>
              <FontAwesome name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Contact</Text>
            </Pressable>
          ) : null
        }
      />
      <ContactModal
        visible={modalVisible}
        editing={editingContact}
        form={form}
        saving={saving}
        formError={formError}
        updateField={updateField}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

interface ModalProps {
  visible: boolean;
  editing: Contact | null;
  form: typeof EMPTY_FORM;
  saving: boolean;
  formError: string;
  updateField: (key: keyof typeof EMPTY_FORM, value: string | boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

function ContactModal({ visible, editing, form, saving, formError, updateField, onSave, onClose }: ModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalScroll}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Contact' : 'Add Contact'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={theme.textSecondary} value={form.name} onChangeText={(v) => updateField('name', v)} autoComplete="name" />

          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={theme.textSecondary} value={form.phone} onChangeText={(v) => updateField('phone', v)} keyboardType="phone-pad" autoComplete="tel" />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={theme.textSecondary} value={form.email} onChangeText={(v) => updateField('email', v)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />

          <Text style={styles.label}>Relationship</Text>
          <TextInput style={styles.input} placeholder="e.g. Daughter, Neighbor, Doctor" placeholderTextColor={theme.textSecondary} value={form.relationship} onChangeText={(v) => updateField('relationship', v)} />

          <View style={styles.switchSection}>
            <Text style={styles.switchSectionTitle}>Notifications</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Emergency contact</Text>
              <Switch value={form.isEmergency} onValueChange={(v) => updateField('isEmergency', v)} trackColor={{ true: theme.danger }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Notify when I need help</Text>
              <Switch value={form.notifyOnHelp} onValueChange={(v) => updateField('notifyOnHelp', v)} trackColor={{ true: theme.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Notify on missed check-in</Text>
              <Switch value={form.notifyOnMissed} onValueChange={(v) => updateField('notifyOnMissed', v)} trackColor={{ true: theme.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Notify on declining trend</Text>
              <Switch value={form.notifyOnDecline} onValueChange={(v) => updateField('notifyOnDecline', v)} trackColor={{ true: theme.primary }} />
            </View>
          </View>

          <Pressable disabled={saving} style={({ pressed }) => [styles.saveButton, (pressed || saving) && { opacity: 0.85 }]} onPress={onSave}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : editing ? 'Update Contact' : 'Add Contact'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  emergencyBadge: { backgroundColor: theme.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  emergencyText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  sihatyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.primaryLight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  sihatyBadgeText: { color: theme.primary, fontSize: 11, fontWeight: '700' },
  cardRelationship: { fontSize: 14, color: theme.textSecondary, marginTop: 2 },
  cardDetail: { fontSize: 14, color: theme.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 12 },
  actionButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  notifyRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  notifyChip: { backgroundColor: theme.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  notifyChipText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  arrowBtns: { gap: 4 },
  arrowBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  arrowBtnDisabled: { backgroundColor: '#F9FAFB' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 18, marginHorizontal: 20, marginTop: 8 },
  addBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  addFirstBtn: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, marginTop: 20 },
  addFirstBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  emptyCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, paddingBottom: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptySubtext: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  modalContainer: { flex: 1, backgroundColor: theme.background },
  modalScroll: { padding: 24, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
  formError: { color: theme.danger, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: theme.card, borderRadius: 14, padding: 18, fontSize: 17, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border },
  switchSection: { marginTop: 24 },
  switchSectionTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  switchLabel: { fontSize: 16, color: theme.textPrimary, flex: 1, marginRight: 12 },
  saveButton: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 20, alignItems: 'center', marginTop: 28 },
  saveButtonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
});
```

- [ ] **Step 2: Build check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add app/components/MyContactsList.tsx
git commit -m "feat: MyContactsList component with edit-order mode and sort_order API sync"
```

---

## Task 10: Rewrite Circle Screen

**Files:**
- Modify: `app/app/(tabs)/circle.tsx`

- [ ] **Step 1: Replace circle.tsx entirely**

```typescript
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/constants/Colors';
import { WatchingList } from '@/components/WatchingList';
import { MyContactsList } from '@/components/MyContactsList';

type Tab = 'watching' | 'contacts';

export default function CircleScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('watching');
  const [editing, setEditing] = useState(false);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Circle</Text>
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setEditing((e) => !e)}>
          <Text style={styles.editBtnText}>{editing ? 'Done' : 'Edit Order'}</Text>
        </Pressable>
      </View>

      <View style={styles.segControl}>
        <Pressable
          style={[styles.segBtn, activeTab === 'watching' && styles.segBtnActive]}
          onPress={() => switchTab('watching')}>
          <Text style={[styles.segBtnText, activeTab === 'watching' && styles.segBtnTextActive]}>
            Watching
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, activeTab === 'contacts' && styles.segBtnActive]}
          onPress={() => switchTab('contacts')}>
          <Text style={[styles.segBtnText, activeTab === 'contacts' && styles.segBtnTextActive]}>
            My Contacts
          </Text>
        </Pressable>
      </View>

      {activeTab === 'watching' ? (
        <WatchingList editing={editing} />
      ) : (
        <MyContactsList editing={editing} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  editBtn: {
    backgroundColor: theme.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editBtnText: { fontSize: 14, fontWeight: '700', color: theme.primary },
  segControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  segBtnTextActive: { color: theme.primary },
});
```

- [ ] **Step 2: Test manually**

Run the app. Navigate to Circle tab. Verify:
- Segmented control shows "Watching" and "My Contacts"
- Tapping switches between the two sub-tabs
- Switching tabs resets editing mode to false
- "Edit Order" toggles to "Done" and back
- In Watching edit mode, ▲▼ appear and contacts reorder
- In My Contacts edit mode, ▲▼ appear and edit/delete buttons are hidden
- Add Contact button appears in My Contacts normal mode, hidden in edit mode

- [ ] **Step 3: Commit**

```bash
git add app/app/(tabs)/circle.tsx
git commit -m "feat: Circle screen with segmented Watching/My Contacts tabs and Edit Order"
```

---

## Task 11: Add Alerts to History Screen

**Files:**
- Modify: `app/app/(tabs)/history.tsx`

- [ ] **Step 1: Replace history.tsx**

```typescript
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import { STATUS_META } from '@/lib/status';
import type { Alert as AlertItem, AlertType, Checkin } from '@/lib/types';

const ALERT_META: Record<AlertType, { label: string; color: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }> = {
  need_help: { label: 'Needs Help', color: theme.danger, icon: 'exclamation-circle' },
  missed_checkin: { label: 'Missed Check-in', color: theme.warning, icon: 'clock-o' },
  decline_pattern: { label: 'Declining Trend', color: theme.warning, icon: 'arrow-down' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(iso) === dayKey(now.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

interface Section { title: string; data: Checkin[]; }

function groupByDay(items: Checkin[]): Section[] {
  const groups = new Map<string, Section>();
  for (const item of items) {
    const key = dayKey(item.createdAt);
    if (!groups.has(key)) groups.set(key, { title: dayLabel(item.createdAt), data: [] });
    groups.get(key)!.data.push(item);
  }
  return Array.from(groups.values());
}

export default function HistoryScreen() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [checkinRes, alertRes] = await Promise.all([
        apiRequest<{ checkins: Checkin[] }>('/checkins'),
        apiRequest<AlertItem[]>('/alerts'),
      ]);
      setCheckins(checkinRes.checkins);
      setAlerts(alertRes);
    } catch {
      // Silent — 401s handled by auth guard
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const markSeen = async (id: string) => {
    try {
      await apiRequest(`/alerts/${id}`, { method: 'PUT', body: { status: 'seen' } });
      setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, status: 'seen' } : a)));
    } catch { /* Silent */ }
  };

  const sections = useMemo(() => groupByDay(checkins), [checkins]);

  const alertsHeader = (
    <View style={styles.alertsSection}>
      <Text style={styles.sectionHeader}>Alerts 🔔</Text>
      {alerts.length === 0 ? (
        <View style={styles.noAlerts}>
          <Text style={styles.noAlertsText}>All clear — no alerts</Text>
        </View>
      ) : (
        alerts.map((item) => {
          const meta = ALERT_META[item.alertType];
          const isNew = item.status === 'sent';
          return (
            <Pressable
              key={item._id}
              style={[styles.alertCard, !isNew && styles.alertCardSeen]}
              onPress={() => isNew && markSeen(item._id)}>
              <View style={styles.alertTop}>
                <View style={[styles.alertBadge, { backgroundColor: meta.color }]}>
                  <FontAwesome name={meta.icon} size={12} color="#FFF" />
                  <Text style={styles.alertBadgeText}>{meta.label}</Text>
                </View>
                {isNew && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>New</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.alertContact, !isNew && styles.dimmed]}>
                {item.contactId?.name ?? 'Unknown contact'}
                {item.contactId?.relationship ? ` (${item.contactId.relationship})` : ''}
              </Text>
              {item.message ? <Text style={[styles.alertMessage, !isNew && styles.dimmed]}>{item.message}</Text> : null}
              <Text style={styles.alertTime}>{relativeTime(item.createdAt)}</Text>
            </Pressable>
          );
        })
      )}
      <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Your Check-Ins 📋</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loaded && checkins.length === 0 && alerts.length === 0 ? (
        <>
          <Text style={styles.title}>History</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.emptySubtext}>Your check-ins and alerts will appear here</Text>
          </View>
        </>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>History</Text>
              {alertsHeader}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const order = ['need_help', 'not_great', 'okay', 'great'];
            const worst = order.find(
              (s) => s === item.physicalStatus || s === item.mentalStatus
            ) as typeof item.physicalStatus;
            const accent = STATUS_META[worst];
            return (
              <View style={[styles.historyCard, { borderLeftColor: accent.color }]}>
                <View style={styles.historyRow}>
                  <View style={styles.statusGroup}>
                    <View style={styles.emojiRow}>
                      <Text style={styles.statusEmoji}>{STATUS_META[item.physicalStatus].emoji}</Text>
                      <Text style={styles.statusEmoji}>{STATUS_META[item.mentalStatus].emoji}</Text>
                    </View>
                    <Text style={styles.statusLabel}>
                      Body: {STATUS_META[item.physicalStatus].short} · Mind: {STATUS_META[item.mentalStatus].short}
                    </Text>
                  </View>
                  <Text style={styles.historyTime}>
                    {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                {item.note ? <Text style={styles.historyNote}>"{item.note}"</Text> : null}
              </View>
            );
          }}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary, marginTop: 16, marginBottom: 16 },
  list: { paddingBottom: 24 },
  alertsSection: { marginBottom: 4 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
    marginTop: 8,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noAlerts: { paddingVertical: 12 },
  noAlertsText: { fontSize: 14, color: theme.textSecondary, fontStyle: 'italic' },
  alertCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10 },
  alertCardSeen: { opacity: 0.65 },
  alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  alertBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  newBadge: { backgroundColor: theme.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  newBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  alertContact: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  alertMessage: { fontSize: 14, color: theme.textSecondary, marginBottom: 4 },
  alertTime: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  dimmed: { color: theme.textSecondary },
  historyCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, borderLeftWidth: 4 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusGroup: { flex: 1, flexDirection: 'column' },
  emojiRow: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  statusEmoji: { fontSize: 22 },
  statusLabel: { fontSize: 13, color: theme.textSecondary },
  historyTime: { fontSize: 14, color: theme.textSecondary, marginLeft: 12 },
  historyNote: { fontSize: 14, color: theme.textSecondary, fontStyle: 'italic', marginTop: 8 },
  emptyCard: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptySubtext: { fontSize: 16, color: theme.textSecondary },
});
```

- [ ] **Step 2: Test manually**

Run the app. Navigate to History tab. Verify:
- "Alerts 🔔" section appears at the top with any existing alerts
- "All clear — no alerts" shown when no alerts exist
- Tapping a "New" alert marks it seen (badge disappears, card dims)
- "Your Check-Ins 📋" section appears below with existing check-in history
- Pull-to-refresh reloads both sections

- [ ] **Step 3: Commit**

```bash
git add app/app/(tabs)/history.tsx
git commit -m "feat: History screen combines alerts section and check-in history"
```

---

## Task 12: Delete Orphaned Tab Files

**Files:**
- Delete: `app/app/(tabs)/alerts.tsx`
- Delete: `app/app/(tabs)/contacts.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm app/app/\(tabs\)/alerts.tsx app/app/\(tabs\)/contacts.tsx
```

On Windows PowerShell:
```powershell
Remove-Item "app/app/(tabs)/alerts.tsx", "app/app/(tabs)/contacts.tsx"
```

- [ ] **Step 2: Full type check and smoke test**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors. Also start the app and navigate through all 4 tabs to confirm no crashes.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: remove orphaned alerts.tsx and contacts.tsx tab screens"
```
