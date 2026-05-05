# Navigation Restructure — Design Spec

**Date:** 2026-05-05  
**Scope:** Mobile app tab bar and screen organisation  
**Status:** Approved

---

## Problem

The current app has 7 bottom tabs (Home, Check-In, History, Alerts, Circle, Contacts, Settings). For the primary user group — elderly people — this is too many. Labels are cramped at 7 items, and the separation between overlapping concepts (Circle vs Contacts, Alerts vs History) adds unnecessary cognitive load. The PRD specifies 3 tabs; the implementation has diverged significantly.

---

## Decision

Consolidate to **4 tabs**: Home · Circle · History · Settings.

Three tabs are removed as standalone tabs — Check-In, Alerts, and Contacts — and their content is absorbed into the remaining four screens.

---

## Tab Structure

### 1. Home

The primary sender surface. Unchanged in content; the Check-In tab is retired.

**Contents:**
- Green hero header: greeting by name + date (existing)
- Last check-in status card (existing)
- "Start Check-In" CTA card (existing) — primary entry point to the check-in flow
- Floating action button (FAB, coral `+`) — secondary shortcut to the same check-in flow, visible on Home tab only

The check-in flow itself (`/checkin` screen) is unchanged — still a 3-step wizard navigated to via `router.push('/checkin')`.

### 2. Circle

The social/network tab. Absorbs the Contacts tab via a segmented control.

**Segmented control at top:** "Watching" | "My Contacts"

**Watching sub-tab** (receiver view):
- Lists people who have added the current user as a contact in their own app and are on Sihaty
- Each row: avatar initials, name, last check-in time, traffic-light dot (green / amber / grey)
- Traffic light: green = checked in today with okay/great, amber = not_great/need_help today, grey = no check-in today
- "Edit Order" button in header **toggles edit mode**: tapping it shows ▲ ▼ buttons per row and replaces itself with a "Done" button; tapping Done exits edit mode and saves order

**My Contacts sub-tab** (sender view):
- Lists contacts the current user has added (existing Contacts screen content)
- Each row: avatar initials, name, relationship, alert preference summary (Help / Missed / Decline chips)
- Edit (✏) icon per row opens existing add/edit modal
- "Edit Order" button in header **toggles edit mode** identically to Watching sub-tab
- "+ Add Contact" button at bottom of list; newly added contacts default to the bottom of the list (`sort_order = MAX(sort_order) + 1`)

**Sorting behaviour:**
- Both sub-tabs default to the user's saved custom order
- Order is stored as an integer `sort_order` column on the relevant table (contacts for My Contacts; a new user preference or local store for Watching)
- ▲ moves item one position up, ▼ moves one position down; ▲ is disabled when item is first in list, ▼ is disabled when item is last
- Order is saved immediately on each tap (no separate save action beyond "Done" exiting the mode)
- Order persists across sessions and app restarts

### 3. History

Combines the former Alerts tab and the former History tab into a single scrollable screen.

**Layout — two sections, stacked:**

**Alerts section (top):**
- Section label "Alerts 🔔"
- Each alert row: colour-coded left dot (red = need_help / missed_checkin, amber = decline_pattern, green = resolved), alert title, timestamp, seen/unseen state
- Tapping an alert marks it as seen (existing API: `PUT /api/alerts/:id`)
- If no alerts: subtle empty state ("No alerts — all good ✓")

**Your Check-Ins section (below Alerts):**
- Section label "Your Check-Ins 📋"
- Day-grouped rows: date label + physical and mental status emoji pills
- Existing pagination/scroll behaviour retained

### 4. Settings

Unchanged in content. Existing settings screen (name, reminder frequency, reminder times, account) remains. No structural changes required.

---

## What Is Removed

| Removed tab | Content moved to |
|---|---|
| Check-In tab | Home CTA card + FAB |
| Alerts tab | History screen — Alerts section |
| Contacts tab | Circle screen — My Contacts sub-tab |

---

## Persistent Sort — Data Design

**My Contacts ordering:**  
Add `sort_order INT NOT NULL DEFAULT 0` to the `contacts` table. When the user reorders via ▲▼, issue a `PUT /api/contacts/:id` with the updated `sort_order`. The contacts list endpoint returns rows ordered by `sort_order ASC`.

**Watching ordering:**  
The Watching list is derived from other users' contacts records (the `/circle` endpoint). Sort order for Watching is a client-side preference — store as a JSON array of user IDs in `AsyncStorage` (or `expo-secure-store`) keyed to the current user. No backend change needed.

---

## Accessibility Notes

- 4 tabs produce readable labels at normal font sizes (no cramping)
- FAB is coral (`#F4845F`), 56×56dp minimum, positioned above the tab bar — meets 48dp touch target rule
- ▲▼ sort buttons: minimum 44×44dp touch target each
- ▲ disabled (greyed) when item is first; ▼ disabled when item is last

---

## Out of Scope

- Check-in flow changes (3-step wizard unchanged)
- Settings screen content changes
- History chart / analytics view
- Voice notes
- Any backend changes beyond `sort_order` column on `contacts`
