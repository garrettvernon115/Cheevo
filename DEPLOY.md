# Deploying Cheevo (Demo Mode)

This guide deploys Cheevo as a **public, read-only demo** showing one account's
(your) Xbox library. No visitor logs in; sync is hidden. Flip `NEXT_PUBLIC_DEMO_MODE`
to `false` later to switch the same codebase into multi-user mode.

## Architecture (4 pieces)

| Service | What it is | Notes |
|---|---|---|
| **Frontend** | Next.js (Dockerfile, standalone output) | Publicly exposed. The only thing on the internet. |
| **Backend** | FastAPI (Dockerfile) | Keep **private** — only the frontend should reach it. Holds the OpenXBL key. |
| **Postgres** | Managed database | Source of all displayed data. |
| **Redis** | Managed cache | Caches OpenXBL responses. |

Page views read **only from Postgres** (no OpenXBL calls), so the public demo
can't burn your OpenXBL quota.

Recommended host: **Railway** (one platform for all four, private networking,
managed Postgres + Redis, builds from your Dockerfiles). Render / Fly.io work too.

---

## Step 1 — Push to GitHub
Commit everything (the Dockerfiles and `.dockerignore`s are already in place).
Confirm `.env.local` and `backend/.env` are git-ignored — they must never be committed.

## Step 2 — Provision Postgres + Redis
On Railway: **New Project → add Postgres → add Redis**. Copy their **internal**
connection strings (private network, no SSL hassle).

> ⚠️ The app uses the async driver, so the DB URL scheme must be
> `postgresql+asyncpg://...`, not `postgres://...`. Convert the scheme when you
> paste it into `DATABASE_URL`.

## Step 3 — Deploy the backend
Point a new service at the repo with **root directory = `backend`** (it'll use
`backend/Dockerfile`). Do **not** give it a public domain — keep it private.

Set these variables:

| Var | Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://USER:PASS@HOST:PORT/DB` (internal) |
| `REDIS_URL` | `redis://HOST:PORT` (internal) |
| `OPENXBL_API_KEY` | your xbl.io key |
| `DEBUG` | `false` |

The container runs `alembic upgrade head` on boot, so the schema is created
automatically. (`PORT` is injected by the platform.)

## Step 4 — Seed the demo data (one-time)
The prod database starts empty. Populate it once by running a single sync against
your XUID. From the backend service's shell (Railway: service → Shell), or a
temporary one-off command:

```bash
curl -X POST "http://localhost:${PORT:-8082}/api/profile/sync?achievements=true" \
  -H "x-user-xuid: 2535444055496983"
```

This pulls your profile, games, and achievements from OpenXBL into Postgres (uses
your OpenXBL quota once). Re-run whenever you want to refresh the demo.

*Alternative:* `pg_dump` your local DB and restore into the managed one — exact
copy, no OpenXBL call.

## Step 5 — Deploy the frontend
New service, **root directory = `frontend`** (`frontend/Dockerfile`). This one
**gets the public domain.**

`NEXT_PUBLIC_*` values are baked in at **build time**, so they must be set as
**build args** (Railway exposes build-time variables; or they're read from the
service variables during build):

| Var | Build-time? | Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **yes** | the backend's **internal** URL, e.g. `http://backend.railway.internal:8082` |
| `NEXT_PUBLIC_DEMO_MODE` | **yes** | `true` |
| `DEMO_XUID` | runtime | `2535444055496983` |
| `AUTH_SECRET` | runtime | a random 32+ char secret (`openssl rand -base64 32`) — NextAuth initializes even in demo |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | runtime | your client ID (unused in demo, needed for multi-user later) |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | runtime | your client secret |
| `AUTH_URL` | runtime | `https://your-frontend-domain` |

## Step 6 — Verify
- Open the frontend domain → dashboard loads with **no login**, shows the demo
  account, **Demo** badge top-right, **no Sync/Sign-out** buttons.
- Click a game → detail page loads.
- Backend has **no** public URL (check it's private).

---

## Gotchas
- **`postgresql+asyncpg://`** scheme on `DATABASE_URL` (not `postgres://`).
- **`NEXT_PUBLIC_*` are build-time** — changing them requires a frontend rebuild,
  not just a restart.
- Keep the **backend private**; it trusts the `x-user-xuid` header and holds the
  OpenXBL key. A public backend is the main thing to re-harden before multi-user.
- The Master Chief favicon/logo and `/cheevo-mark.png` are committed assets, so
  they ship in the image automatically.

## Switching to multi-user later
Set `NEXT_PUBLIC_DEMO_MODE=false` and rebuild the frontend → the proxy re-enables
auth gating and pages use the signed-in user's XUID. (The full multi-user rework —
OpenXBL per-user OAuth, per-user tokens — is tracked separately.)
