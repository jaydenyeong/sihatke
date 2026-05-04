# Supabase Migration — Manual Steps

The code is migrated. You still need to do three things manually:

## 1. Run the schema in Supabase

1. Open https://supabase.com/dashboard → project `sihatke`
2. Left sidebar → **SQL Editor** → **New query**
3. Open `server/supabase/schema.sql`, copy its full contents, paste into the editor
4. Click **Run**

You should see "Success. No rows returned." Verify by clicking **Table Editor** in the sidebar — you should see `users`, `checkins`, `contacts`, `alerts`, `push_tokens`.

> The script is safe to re-run during development — it drops and recreates everything. **Don't re-run it once you have real data.**

## 2. Get your Supabase API keys

1. In the dashboard → **Project Settings** (gear icon, bottom-left) → **API**
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **service_role secret** (under "Project API keys" — click the eye icon to reveal). **Never ship this to the mobile app**; it bypasses Row-Level Security.

## 3. Set env vars

### Locally (for `npm run dev`)

Create `server/.env`:

```
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_service_role_key...
JWT_SECRET=any-long-random-string
PORT=3000
```

`server/.env` is already gitignored.

### On Render (for production)

1. https://dashboard.render.com → your `sihaty-api` service → **Environment**
2. **Add** the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values
3. **Delete** the old `MONGO_URI` env var (no longer used)
4. Click **Save Changes** — Render redeploys automatically

## 4. Verify

After Render redeploys (~2 min), open:
```
https://sihaty-api.onrender.com/health
```
Should return `{"status":"ok"}`.

Test end-to-end:
1. In the app, register a new user → should get JWT back
2. Sign in → see Home screen
3. Do a check-in → check Supabase **Table Editor** → `checkins` table → row should appear
4. Add a contact → row in `contacts`
5. Check-in with "Need Help" → row in `alerts`

If anything fails, check Render logs (Dashboard → service → **Logs**). The most common issues:
- "Missing Supabase credentials" → env vars not set or saved
- "permission denied for table users" → using `anon` key instead of `service_role` key

## What changed in the code

| File | Action |
|---|---|
| `server/src/db/supabase.ts` | NEW — lazy Supabase client |
| `server/src/db/types.ts` | NEW — Postgres row types (snake_case) |
| `server/src/db/mappers.ts` | NEW — snake_case → camelCase + `_id` for API responses |
| `server/src/config/env.ts` | `MONGO_URI` → `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| `server/src/index.ts` | `mongoose.connect` → Supabase health check; loads `.env` via `dotenv/config` |
| `server/src/routes/*.ts` | All Mongoose queries → Supabase queries |
| `server/src/services/*.ts` | All Mongoose queries → Supabase queries |
| `server/src/models/` | **Deleted** — Mongoose schemas no longer used |
| `package.json` | Removed `mongoose`, added `@supabase/supabase-js` and `dotenv` |

The mobile app needs **no changes** — API response shapes (camelCase + `_id`) are preserved by the mappers.
