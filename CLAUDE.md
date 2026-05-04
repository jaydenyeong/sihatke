# Sihaty

Privacy-first mobile health check-in app for elderly users. A free, simple two-tap-per-check-in app that lets elderly people share how they feel several times a day with a trusted circle, with paid services (telehealth, professional monitoring, premium analytics, in-app advertising for senior-relevant brands) layered on once the network grows.

# Value Proposition
For senders (elderly users): "Tell the people who love you how you're doing today, in 10 seconds. They'll know you're okay without you having to call everyone."

For receivers (family, neighbours): "Stop wondering if Mum is alright. Get a small green tick three times a day, and a real alert when something is off."


## Product

See [docs/PRD.md](docs/PRD.md) for full product spec.
See [docs/architecture.md](docs/architecture.md) for system design, schema, API, and roadmap.

## Tech Stack

- **Frontend:** React Native + Expo (SDK 54), TypeScript, Expo Router
- **UI:** Custom components + FontAwesome icons
- **Backend:** Express.js + TypeScript, deployed to Render
- **Database:** Supabase (Postgres) — project name `sihatke`
- **Auth:** JWT + bcrypt (custom, on Express)
- **Notifications:** Expo Push Notifications via `expo-server-sdk`
- **Background jobs:** node-cron (in-process on Express)
- **Deployment:** EAS Build + EAS Submit (mobile), Render auto-deploy from `main` (backend)

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
│       ├── db/             # Supabase client + table types
│       ├── models/         # (legacy Mongoose — being replaced by Supabase queries)
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
cd app && npm start            # tunnel mode
cd app && npm run start:lan    # LAN mode (faster on same Wi-Fi)

# Backend (reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from server/.env)
cd server && npm run dev
```

The mobile app's API URL auto-resolves: it auto-detects the LAN dev server during `expo start`, falls through to the production Render URL otherwise. Override per-build via `EXPO_PUBLIC_API_URL` in `app/.env`.
