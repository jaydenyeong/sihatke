# Sihaty - System Architecture & MVP Plan

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
│     │         │          │             │         │
│     └─────────┴──────┬───┴─────────────┘         │
│                      │                           │
│                 REST API calls                    │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│              Express.js API Server                │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │   Auth   │  │  Routes  │  │  Middleware     │  │
│  │  (JWT)   │  │ (REST)   │  │  (validation,  │  │
│  │          │  │          │  │   auth guard)  │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Mongoose │  │node-cron │  │   Services     │  │
│  │  (ODM)   │  │(scheduled│  │  (alerts,      │  │
│  │          │  │  tasks)  │  │   patterns)    │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
└───────────────────────┬──────────────────────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
┌──────────────────┐  ┌────────────────────────────┐
│  MongoDB (local) │  │   Expo Push Notifications   │
│                  │  │   (via Express endpoints)   │
└──────────────────┘  └────────────────────────────┘
```

### Component Breakdown

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Mobile App** | React Native + Expo | Cross-platform iOS/Android |
| **API Server** | Express.js + TypeScript | REST API, business logic |
| **Auth** | JWT (jsonwebtoken + bcrypt) | Email/password authentication |
| **Database** | MongoDB (local) + Mongoose | All persistent data |
| **Notifications** | Expo Push Notifications | Check-in reminders + alerts to contacts |
| **Background Jobs** | node-cron | Missed check-in detection, pattern analysis |
| **Storage** | Local filesystem (multer) | Profile avatars, voice notes |

> **Migration note:** Can migrate to Supabase/cloud DB later if needed. The Express API layer makes this a straightforward swap.

---

## 2. Tech Stack

| Category | Choice | Why |
|----------|--------|-----|
| **Framework** | React Native + Expo (SDK 52+) | One codebase, fast iteration, OTA updates |
| **Language** | TypeScript | Type safety, better DX |
| **Navigation** | Expo Router | File-based routing, simple mental model |
| **State** | Zustand | Lightweight, minimal boilerplate |
| **UI Components** | Custom + React Native Paper | Accessible components, Material Design base |
| **Backend** | Express.js | Simple, flexible, huge ecosystem |
| **Database** | MongoDB (local) + Mongoose | Schema-flexible, easy local setup, no server config |
| **Auth** | JWT + bcrypt | Simple, stateless, no external dependency |
| **Notifications** | Expo Push Notifications | Free push notifications |
| **Background Jobs** | node-cron | Lightweight scheduled tasks |
| **Deployment** | EAS Build + EAS Submit | Streamlined app store deployment |

**Cost estimate (MVP):** $0 — everything runs locally during development

---

## 3. Database Schema

```typescript
// User (profile + auth combined)
const userSchema = new Schema({
  email:            { type: String, required: true, unique: true },
  password:         { type: String, required: true },          // bcrypt hashed
  fullName:         { type: String, required: true },
  avatarUrl:        { type: String },
  dateOfBirth:      { type: Date },
  checkinTimes:     { type: [String], default: ['09:00'] },    // HH:mm format
  checkinFrequency: { type: Number, default: 1 },
  timezone:         { type: String, default: 'UTC' },
}, { timestamps: true });

// Check-in
const checkinSchema = new Schema({
  userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  physicalStatus: { type: String, enum: ['great', 'okay', 'not_great', 'need_help'], required: true },
  mentalStatus:   { type: String, enum: ['great', 'okay', 'not_great', 'need_help'], required: true },
  note:           { type: String },
  voiceNoteUrl:   { type: String },
}, { timestamps: true });

// Trusted Contact
const contactSchema = new Schema({
  userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contactUserId:   { type: Schema.Types.ObjectId, ref: 'User' },  // if contact also uses the app
  name:            { type: String, required: true },
  phone:           { type: String },
  email:           { type: String },
  relationship:    { type: String },                               // e.g. 'daughter', 'neighbor'
  notifyOnHelp:    { type: Boolean, default: true },
  notifyOnMissed:  { type: Boolean, default: true },
  notifyOnDecline: { type: Boolean, default: false },
  isEmergency:     { type: Boolean, default: false },
}, { timestamps: true });

// Alert
const alertSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  alertType: { type: String, enum: ['need_help', 'missed_checkin', 'decline_pattern'], required: true },
  message:   { type: String },
  status:    { type: String, enum: ['sent', 'seen', 'responded'], default: 'sent' },
}, { timestamps: true });

// Push Token
const pushTokenSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token:    { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'android'] },
}, { timestamps: true });
```

### Data Access Control

Access control is enforced at the Express middleware/route level:
- **Auth middleware** verifies JWT and attaches `req.user`
- **All queries scoped to `req.user.id`** — users can only access their own data
- **Contact access:** contacts linked via `contactUserId` can view summarized status only (no raw notes)

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
| POST | `/api/checkins` | Create a check-in |
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
| GET | `/api/alerts` | Get alerts (sent or received) |
| PUT | `/api/alerts/:id` | Update alert status (seen/responded) |

### Push Tokens
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/push-tokens` | Register device push token |
| DELETE | `/api/push-tokens/:token` | Remove token on logout |

### Background Jobs (node-cron)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `send-reminder` | Runs every 15 min, checks user schedules | Send push notification to remind user to check in |
| `check-missed` | Runs every hour | Find users who missed their check-in window, escalate alerts |
| `analyze-patterns` | Runs daily at midnight | Detect declining patterns over 7-day window, alert contacts |

---

## 5. MVP Roadmap

### Week 1: Foundation
- [ ] Init Expo project with TypeScript + Expo Router
- [ ] Init Express.js backend with TypeScript
- [ ] Set up MongoDB connection + Mongoose models
- [ ] Implement auth (register / login with JWT)
- [ ] Create profile setup screen
- [ ] Build bottom tab navigation (Home, Check-In, History, Alerts, Contacts, Settings)

### Week 2: Core Check-in Flow
- [ ] Build Home screen (greeting, last check-in card, "Start Check-In" CTA)
- [ ] Build Check-in screen (tap-based physical + mental status selection)
- [ ] Optional text note input
- [ ] Save check-ins to MongoDB via API
- [ ] Build History screen (list of past check-ins)

### Week 3: Contacts & Alerts
- [ ] Build Contacts screen (add/edit/remove trusted contacts)
- [ ] Implement push notifications (Expo)
- [ ] Implement alert logic in check-in service (alert on "need_help")
- [ ] Build Alerts screen (list of sent/received alerts)
- [ ] Contact notification preferences

### Week 4: Reminders & Polish
- [ ] Implement check-in reminders (scheduled push notifications)
- [ ] Build `check-missed` node-cron job
- [ ] Settings screen (check-in frequency, times, notification preferences)
- [ ] UI polish — match design reference (green theme, large buttons, rounded cards)
- [ ] Accessibility pass (font scaling, contrast, touch targets 48px+)

### Week 5: Testing & Launch Prep
- [ ] End-to-end testing on iOS + Android
- [ ] Build `analyze-patterns` node-cron job (basic: 3+ "not_great" in 7 days)
- [ ] App store assets (screenshots, description)
- [ ] EAS Build + Submit

### Skip for MVP (build later)
- Voice notes
- Community mode
- Advanced pattern analysis (ML)
- Social login
- Localization/i18n
- In-app chat between user and contacts

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
- **One-tap check-in start** — the primary CTA is impossible to miss
- **Emoji-based status selection** — universally understood, no reading required
- **Progressive disclosure** — optional note field appears after status selection
- **Notification badge on Alerts tab** — contacts see unread count

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
- Voice notes stored encrypted, auto-deleted after 30 days

### Consent Model
- **User consent:** Explicit opt-in for each feature (notifications, contact sharing)
- **Contact consent:** Contacts must accept invitation before receiving updates
- **Granular control:** User chooses exactly what each contact can see
- **Right to delete:** One-tap account deletion removes all data

### Emergency Override
- If user selects "Need Help" → immediate alert to ALL emergency contacts
- If 2+ consecutive check-ins missed → escalating alerts:
  1. First missed: gentle reminder to user
  2. Second missed: notify primary contact
  3. Third missed: notify all emergency contacts
- Emergency contacts can request a "wellness check" push notification

### Technical Security
- All data encrypted in transit (HTTPS/TLS) once deployed
- Auth via JWT — tokens stored in Expo SecureStore (not AsyncStorage)
- Passwords hashed with bcrypt (salt rounds: 12)
- All API routes scoped to authenticated user — no cross-user data access
- Input validation with express-validator on all endpoints
- No data sold or shared with third parties

---

## 8. Bonus

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
