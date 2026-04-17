# Sihaty

Privacy-first mobile health check-in app for elderly users.

## Product

See [docs/PRD.md](docs/PRD.md) for full product spec.
See [docs/architecture.md](docs/architecture.md) for system design, schema, API, and roadmap.

## Tech Stack

- **Frontend:** React Native + Expo (SDK 52+), TypeScript, Expo Router
- **State:** Zustand (not yet installed)
- **UI:** Custom components + FontAwesome icons
- **Backend:** Express.js + TypeScript + MongoDB (Mongoose)
- **Auth:** JWT + bcrypt
- **Notifications:** Expo Push Notifications
- **Deployment:** EAS Build + EAS Submit

## Project Structure

```
sihatke/
├── app/                    # Expo mobile app
│   ├── app/
│   │   ├── (tabs)/         # Tab screens (Home, CheckIn, History, Alerts, Contacts, Settings)
│   │   ├── login.tsx       # Login screen
│   │   ├── register.tsx    # Registration screen
│   │   └── _layout.tsx     # Root navigation layout
│   ├── constants/Colors.ts # Theme colors
│   └── components/         # Shared components
├── server/                 # Express API server
│   └── src/
│       ├── config/         # Environment config
│       ├── models/         # Mongoose schemas (User, Checkin, Contact, Alert, PushToken)
│       ├── routes/         # API routes (auth, profile, checkins, contacts, alerts)
│       ├── middleware/      # Auth middleware (JWT)
│       ├── services/       # Business logic
│       └── index.ts        # Server entry point
└── docs/                   # Product spec and architecture docs
```

## Development

- Solo developer project — prefer simple, maintainable architecture
- Prioritize shipping MVP fast, avoid overengineering
- All UI must be accessible: large touch targets (48dp+), high contrast, minimal text

## Running Locally

```bash
# Mobile app
cd app && npx expo start

# Backend (requires MongoDB running locally)
cd server && npm run dev
```
