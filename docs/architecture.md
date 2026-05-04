# Sihaty - System Architecture

> Last updated: 2026-04-18 — reflects Supabase migration plan and deployed Render + EAS setup.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────┐
│                  Mobile App                      │
│            (React Native + Expo)                 │
│                                                  │
│  ┌──────┐ ┌────────┐ ┌───────┐ ┌─────────────┐ │
│  │ Home │ │CheckIn │ │History│ │  Contacts   │ │
│  └──┬───┘ └───┬────┘ └───┬───┘ └──────┬──────┘ │
│     │         │          │             │        │
│     └─────────┴──────┬───┴─────────────┘        │
│                      │                           │
│           HTTPS REST + Bearer JWT                 │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│        Express.js API (deployed on Render)        │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │   Auth   │  │  Routes  │  │  Middleware     │  │
│  │  (JWT +  │  │  (REST)  │  │  (validation,  │  │
│  │  bcrypt) │  │          │  │   auth guard)  │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Supabase │  │node-cron │  │   Services     │  │
│  │  client  │  │(reminders│  │  (alerts,      │  │
│  │ (pg/SDK) │  │ +missed +│  │   patterns,    │  │
│  │          │  │ patterns)│  │   push)        │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
└───────────────────────┬──────────────────────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
┌──────────────────────┐  ┌────────────────────────────┐
│  Supabase (Postgres) │  │   Expo Push Notifications   │
│  - data tables       │  │   (via Express endpoints)   │
│  - storage (avatars) │  │                             │
└──────────────────────┘  └────────────────────────────┘
```

### Component Breakdown

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Mobile App** | React Native + Expo (SDK 54) | Cross-platform iOS/Android |
| **API Server** | Express.js + TypeScript on Render | REST API, business logic, cron jobs |
| **Auth** | JWT (jsonwebtoken + bcrypt) | Email/password authentication |
| **Database** | **Supabase Postgres** | All persistent data |
| **Storage** | Supabase Storage (later) | Profile avatars, voice notes |
| **Notifications** | Expo Push Notifications via `expo-server-sdk` | Reminders + alerts to contacts |
| **Background Jobs** | node-cron (in-process on Express) | Reminders, missed check-in detection, decline patterns |

> **Why Supabase over MongoDB:** Cleaner schema with foreign-key integrity, built-in dashboard for inspecting data, room to opt into Row-Level Security and Supabase Auth later without re-platforming, generous free tier (500MB Postgres + 1GB storage).

---

## 2. Tech Stack

| Category | Choice | Why |
|----------|--------|-----|
| **Framework** | React Native + Expo (SDK 54) | One codebase, fast iteration, OTA updates |
| **Language** | TypeScript | Type safety, better DX |
| **Navigation** | Expo Router | File-based routing |
| **Backend** | Express.js | Simple, flexible, runs anywhere |
| **Database** | **Supabase (Postgres)** | Hosted, free tier, dashboard, room to grow |
| **DB Client** | `@supabase/supabase-js` (server-side, with service role key) | Typed queries, no ORM overhead |
| **Auth** | JWT + bcrypt (custom, on Express) | Already implemented; can swap for Supabase Auth later |
| **Notifications** | Expo Push Notifications | Free push notifications |
| **Background Jobs** | node-cron | Lightweight scheduled tasks |
| **App Distribution** | EAS Build + EAS Submit | Streamlined Android/iOS deployment |
| **Backend Hosting** | Render (free tier) | Auto-deploys from `main` branch |

**Cost estimate (MVP):** $0/mo — Supabase free tier + Render free tier + Expo free tier. Cold start delay (~30s) on first request after idle on Render free.

---

## 3. Database Schema (Postgres)

```sql
-- Enums
CREATE TYPE status_level AS ENUM ('great', 'okay', 'not_great', 'need_help');
CREATE TYPE alert_type AS ENUM ('need_help', 'missed_checkin', 'decline_pattern');
CREATE TYPE alert_status AS ENUM ('sent', 'seen', 'responded');
CREATE TYPE push_platform AS ENUM ('ios', 'android');

-- Users (auth + profile)
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  full_name          TEXT NOT NULL,
  avatar_url         TEXT,
  date_of_birth      DATE,
  checkin_times      TEXT[] NOT NULL DEFAULT ARRAY['09:00'],
  checkin_frequency  INT  NOT NULL DEFAULT 1 CHECK (checkin_frequency BETWEEN 1 AND 5),
  timezone           TEXT NOT NULL DEFAULT 'UTC',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Check-ins
CREATE TABLE checkins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  physical_status  status_level NOT NULL,
  mental_status    status_level NOT NULL,
  note             TEXT,
  voice_note_url   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_user_created ON checkins (user_id, created_at DESC);

-- Trusted contacts
CREATE TABLE contacts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  phone              TEXT,
  email              TEXT,
  relationship       TEXT,
  notify_on_help     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_missed   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_decline  BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_user ON contacts (user_id);

-- Alerts
CREATE TABLE alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  alert_type  alert_type NOT NULL,
  message     TEXT,
  status      alert_status NOT NULL DEFAULT 'sent',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_user_created ON alerts (user_id, created_at DESC);

-- Push tokens
CREATE TABLE push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    push_platform NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Data Access Control

Access control is enforced at the Express middleware/route level:
- **Auth middleware** verifies JWT and attaches `req.userId` (the `users.id` UUID)
- **All queries scoped to `req.userId`** — users can only access their own data
- **Service-role key only used server-side** — the app never holds Supabase credentials, so we don't yet need Postgres Row-Level Security. RLS becomes worth turning on if/when the app talks to Supabase directly.

---

## 4. API Endpoints

All endpoints prefixed with `/api`. Auth required unless noted.

### Auth
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Create account (public) |
| POST | `/api/auth/login` | Login, returns JWT (public) |
| GET | `/api/auth/me` | Get current user profile |

### Profile
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/profile` | Get own profile |
| PUT | `/api/profile` | Update profile (name, avatar, check-in settings) |

### Check-ins
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/checkins` | Create a check-in (triggers `triggerNeedHelpAlert` if `need_help`) |
| GET | `/api/checkins` | Get check-in history (paginated) |
| GET | `/api/checkins/latest` | Get most recent check-in |

### Contacts
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/contacts` | List trusted contacts |
| POST | `/api/contacts` | Add a contact |
| PUT | `/api/contacts/:id` | Update contact preferences |
| DELETE | `/api/contacts/:id` | Remove a contact |

### Alerts
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/alerts` | Alerts the current user has triggered |
| PUT | `/api/alerts/:id` | Update alert status (`seen`/`responded`) |

### Push Tokens
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/push-tokens` | Register/upsert device push token |
| DELETE | `/api/push-tokens/:token` | Remove token on logout |

### Background Jobs (node-cron, in-process on Express)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `runReminderJob` | Every 15 min | Push reminder if a user is within their check-in window and hasn't checked in |
| `runMissedJob` | Hourly at :05 | If a slot is 30+ min past with no check-in → trigger `missed_checkin` alert |
| `runDeclinePatternCheck` | Daily at 00:30 | If a user has 3+ `not_great`/`need_help` check-ins in 7 days → trigger `decline_pattern` alert (deduped to once per window) |

---

## 5. MVP Roadmap

> All 5 weeks complete. App is deployed and installable as APK pointing at the live Render backend.

### Week 1: Foundation — done
- Init Expo project (TypeScript + Expo Router)
- Init Express.js backend
- Auth (register / login with JWT)
- Profile setup screen
- Bottom tab navigation

### Week 2: Core Check-in Flow — done
- Home screen (greeting, last check-in card, CTA)
- Check-in screen (physical + mental status, optional note)
- Save check-ins via API
- History screen with day grouping

### Week 3: Contacts & Alerts — done
- Contacts CRUD
- Push notifications (`expo-server-sdk`)
- Alert logic for `need_help` status
- Alerts screen with mark-as-seen
- Notification preferences per contact

### Week 4: Reminders & Polish — done
- `runReminderJob` cron
- `runMissedJob` cron
- Editable settings screen (name, frequency, times)
- Accessibility labels on interactive elements
- 10s API timeout with retry UX

### Week 5: Pattern Detection & Launch — done
- `runDeclinePatternCheck` cron with dedup
- EAS build config (development / preview / production profiles)
- Backend deployed to Render with MongoDB Atlas
- Sihaty branding (name, package, splash)

### Post-MVP — in progress
- **Database migration to Supabase** (this work)
- App store submission (Play Store assets + privacy policy)
- UI polish to match design reference
- Voice notes
- Phone OTP login (per updated PRD — would replace email/password later)

### Skip for now
- Community mode
- Advanced pattern analysis (ML)
- Social login
- Localization/i18n

---

## 6. UI/UX Patterns for Elderly Users

### Design Reference
Based on the provided mockup — warm, friendly, minimal.

### Color Palette
| Role | Color | Usage |
|------|-------|-------|
| Primary | `#2E9E6E` (teal green) | Headers, accents, icons |
| CTA | `#F4845F` (warm coral) | Main action buttons |
| Background | `#F8F8F8` (off-white) | Screen backgrounds |
| Card | `#FFFFFF` | Card surfaces |
| Text Primary | `#1A1A1A` | Headlines |
| Text Secondary | `#6B7280` | Subtitles, timestamps |
| Success | `#4ADE80` | "Feeling great" states |
| Warning | `#FBBF24` | "Not great" states |
| Danger | `#EF4444` | "Need help" states |

### Accessibility Rules
1. **Minimum touch target: 48x48dp** (prefer 56+)
2. **Minimum font size: 18sp** for body, 24sp+ for headings
3. **High contrast ratios:** 4.5:1 minimum for all text
4. **No gesture-only actions** — every action has a visible button
5. **No timed interactions** — users can take as long as they need
6. **Simple navigation** — bottom tabs always visible, max 1 tap to any core feature
7. **Confirm destructive actions** with clear, large dialogs
8. **Status feedback** — clear visual + haptic confirmation after check-in

### Key UX Patterns
- **Greeting by name** with time-of-day awareness (Good Morning / Afternoon / Evening)
- **Last check-in summary** always visible on Home
- **One-tap check-in start** — primary CTA is impossible to miss
- **Emoji-based status selection** — universally understood, no reading required
- **Progressive disclosure** — optional note field appears after status selection

### Screen Flow
```
Home → Start Check-In → Physical Status → Mental Status → [Optional Note] → Done!
                                                                              │
                                                                    (auto-saves + alerts)
```

---

## 7. Privacy & Security

### Data Minimization
- Collect only: name, check-in status, optional notes
- No location tracking
- No health data beyond self-reported mood
- No contact list access — contacts entered manually
- Voice notes (when added) stored encrypted, auto-deleted after 30 days

### Consent Model
- **User consent:** Explicit opt-in for each feature (notifications, contact sharing)
- **Contact consent:** Contacts must accept invitation before receiving updates (planned)
- **Granular control:** User chooses exactly what each contact can see (`notifyOnHelp`, `notifyOnMissed`, `notifyOnDecline`)
- **Right to delete:** One-tap account deletion removes all data (planned — `ON DELETE CASCADE` already wired in schema)

### Emergency Override
- If user selects "Need Help" → immediate alert to all contacts with `notify_on_help = true`
- If a check-in slot is missed by 30+ min → alert contacts with `notify_on_missed = true`
- If user trends downward (3+ `not_great`/`need_help` in 7 days) → alert contacts with `notify_on_decline = true`

### Technical Security
- All data encrypted in transit (HTTPS/TLS) — Render serves over HTTPS by default
- Auth via JWT — tokens stored in `expo-secure-store` (not AsyncStorage)
- Passwords hashed with bcrypt (salt rounds: 10)
- All API routes scoped to authenticated user — no cross-user data access
- Input validation with `express-validator` on all endpoints
- Supabase service-role key kept server-side only; never shipped in the app
- No data sold or shared with third parties

---

## 8. Deployment

### Backend (Render)
- Connected to GitHub repo `jaydenyeong/sihatke`, watches `main` branch
- Root directory: `server`
- Build: `npm install && npm run build`
- Start: `npm start`
- Free tier — sleeps after 15 min idle, ~30-50s cold start on first request

**Required env vars on Render:**
| Key | Source |
|---|---|
| `SUPABASE_URL` | Supabase project settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API → `service_role` secret (NEVER ship to client) |
| `JWT_SECRET` | Random string, ≥32 chars |
| `PORT` | `3000` |

### Database (Supabase)
- Project: `sihatke`
- Free tier: 500MB Postgres + 1GB storage + 50K monthly auth users
- Tables created via SQL editor using the DDL in section 3
- Future: enable Postgres Row-Level Security if app starts talking to Supabase directly

### Mobile App (EAS)
- EAS profiles in `app/eas.json`: `development`, `preview` (APK), `production` (signed AAB)
- Production API URL hardcoded as fallback in `app/lib/api.ts:7`
- Override per-build with `EXPO_PUBLIC_API_URL` in `app/.env` for ngrok testing

---

## 9. Bonus

### Differentiating Features

1. **"I'm Okay" Button (Widget)**
   A home screen widget that's literally one tap — no need to open the app. The elderly user taps it, and contacts get a green status. Reduces friction to near zero.

2. **Weekly Wellness Summary**
   Contacts receive a gentle weekly digest: "Mom had a good week — 6/7 check-ins, mostly feeling great." Not daily noise, just a reassuring summary. Builds trust without notification fatigue.

3. **SOS Shake**
   Shake the phone to trigger an emergency alert. No screens to navigate, no buttons to find. Works even with shaky hands or impaired vision.

### Monetization Ideas

1. **Freemium Model**
   - Free: 1 user + up to 3 contacts + basic check-ins
   - Premium ($3.99/mo): Unlimited contacts, voice notes, pattern insights, weekly digest for contacts, priority support

2. **Family Plan ($6.99/mo)**
   - Monitor multiple family members from one contact account
   - Family dashboard with all loved ones' statuses

3. **Healthcare Partnerships (later)**
   - White-label for senior care facilities
   - Integrate with telehealth platforms
   - Anonymized, aggregated wellness data for research (with consent)