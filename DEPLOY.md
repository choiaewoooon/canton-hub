# Canton Hub Deployment Guide

Canton Hub is split into **two independent repos**:

```
~/project/Ozzycanton/
├── canton-hub/              ← THIS REPO — web dashboard
│   ├── api/                 ← FastAPI backend → Fly.io
│   ├── collectors/
│   ├── web/                 ← Next.js frontend → Vercel
│   ├── Dockerfile
│   └── fly.toml
│
├── canton-telegram-bot/     ← SEPARATE REPO — daily telegram bot
│   ├── bot.py               ← Runs on home Mac via LaunchAgent
│   ├── formatter.py
│   ├── image_generator.py
│   └── collectors/
│
└── canton-bot/              ← LEGACY — do not modify
                               Kept as a safety net while splits are verified.
                               You can delete this after the new folders are
                               confirmed working.
```

This doc covers **canton-hub only**. The telegram bot is independent — see
`canton-telegram-bot/` for its own setup.

---

## Architecture

```
┌─────────────────────┐   https   ┌─────────────────────┐
│ web/ (Next.js)      │ ────────▶ │ api/ (FastAPI)      │
│ Vercel              │           │ Fly.io (Tokyo)      │
│ canton-hub.         │           │ canton-api.fly.dev  │
│   vercel.app        │           │ + APScheduler       │
└─────────────────────┘           │ + Playwright        │
                                  └─────────────────────┘
```

The Canton Hub backend is the only long-running data collection service.
The telegram bot (in `canton-telegram-bot/`) runs its own copy of collectors
once a day at 9am KST. They are intentionally decoupled — no API calls
between them, no shared state.

---

## Prerequisites

1. **Accounts**
   - Fly.io: `brew install flyctl && fly auth signup`
   - Vercel: `npm i -g vercel && vercel login`
2. **Secrets** (get these ready)
   - `COINGECKO_API_KEY` — free Demo key at coingecko.com/developers/dashboard
   - `RAPIDAPI_KEY` — Twitter API45 on rapidapi.com
   - `GITHUB_TOKEN` — GitHub PAT (read-only public_repo scope)
3. **Local `.env`** — `cp .env.example .env` and fill in your values. The
   real `.env` is gitignored and will NOT be deployed (Dockerfile skips it).

---

## Phase A — Deploy backend to Fly.io

### A1. Sanity check locally

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub

# Create a fresh venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# Copy secrets in
cp .env.example .env
# edit .env with your real values

# Run the backend
uvicorn api.main:app --port 8000 --reload

# In another terminal, smoke test:
curl http://localhost:8000/api/health
# → {"status":"ok"}
curl http://localhost:8000/api/price
# → real price data after ~30s
```

### A2. Create Fly.io app

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub

fly launch --no-deploy --name canton-api --region nrt --copy-config
```

Interactive prompts:
- `"Would you like to copy its configuration to the new app?"` → **Yes**
- `"Do you want to tweak these settings before proceeding?"` → **No**
- `"Would you like to set up a Postgresql database now?"` → **No**
- `"Would you like to set up an Upstash Redis database?"` → **No**
- `"Create .dockerignore from .gitignore?"` → **No** (we have our own)

⚠ If `canton-api` name is taken → pick another, then update `app = "..."`
in `fly.toml` to match.

### A3. Persistent volume (optional but recommended)

```bash
fly volumes create canton_data --size 1 --region nrt
# "Warning! Creating a single volume..." → yes
```

This stores the `data/*.json` file caches across restarts. Skipping this
is fine — collectors will rebuild on boot.

### A4. Register secrets

```bash
fly secrets set \
  COINGECKO_API_KEY="your_key" \
  RAPIDAPI_KEY="your_key" \
  GITHUB_TOKEN="ghp_xxx" \
  ALLOWED_ORIGINS="*"
```

> Leave `ALLOWED_ORIGINS=*` for now. We'll tighten it to the Vercel URL at
> the end of Phase B.

### A5. Deploy!

```bash
fly deploy
```

- Takes 5~15 min (Playwright Chromium is the bottleneck)
- Watch for build errors; OOM → bump `memory_mb` in `fly.toml` from 512 → 768

### A6. Verify

```bash
fly status                       # → shows https://canton-api.fly.dev
curl https://canton-api.fly.dev/api/health
# → {"status":"ok"}
curl https://canton-api.fly.dev/api/price
# → real data (wait 30-60s after deploy for first scheduler loop)
```

✅ **Report back with**: `fly status` output + curl results.

---

## Phase B — Deploy frontend to Vercel

### B1. Initialize project

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub/web
vercel
```

Interactive prompts:
- `"Set up and deploy?"` → **Y**
- `"Which scope?"` → your personal account
- `"Link to existing project?"` → **N**
- `"Project name?"` → `canton-hub`
- `"In which directory is your code located?"` → `./` (enter)
- `"Want to modify these settings?"` → **N**

Preview URL is printed. The page will show errors because
`NEXT_PUBLIC_API_URL` isn't set yet.

### B2. Register backend URL

```bash
vercel env add NEXT_PUBLIC_API_URL production
# When prompted, paste: https://canton-api.fly.dev
```

### B3. Promote to production

```bash
vercel --prod
```

Prints the prod URL (e.g. `https://canton-hub.vercel.app`).

### B4. Tighten CORS on the backend

Go back to canton-hub root:

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub
fly secrets set ALLOWED_ORIGINS="https://canton-hub.vercel.app"
# ↑ use your actual Vercel URL, no trailing slash
```

Fly.io auto-redeploys in ~30s.

### B5. Smoke test in browser

- [ ] Dashboard loads with live price + B/M Ratio
- [ ] `/feed` shows tweet archive + Korean companies section
- [ ] `/analytics` shows charts
- [ ] Dark/light theme toggle works
- [ ] Open browser DevTools → Console → no red CORS errors

✅ **Report back with**: Vercel URL + screenshot.

---

## Phase C — Leave the telegram bot alone (for now)

The telegram bot is in `canton-telegram-bot/` and is fully independent. It
has its own copy of `collectors/`, its own `.env`, and its own LaunchAgent.
**You do not need to touch it during this deployment.**

After the web is confirmed working for a few days, you may want to migrate
the bot LaunchAgent to the new folder — see the section at the bottom.
Until then, the existing `canton-bot/` folder + its LaunchAgent keep running
the bot exactly as today.

---

## Secrets reference

|                     | Fly.io (backend) | Vercel (frontend) |
|---------------------|:----------------:|:-----------------:|
| COINGECKO_API_KEY   | ✅ | |
| RAPIDAPI_KEY        | ✅ | |
| GITHUB_TOKEN        | ✅ | |
| ALLOWED_ORIGINS     | ✅ | |
| NEXT_PUBLIC_API_URL | | ✅ |

## Cost estimate (monthly)

- Vercel: **$0** (Hobby tier)
- Fly.io: **$0–2** (shared-1x 512MB always-on + 1GB volume)

## Pitfalls

- **Don't commit `.env`** — `.gitignore` excludes it.
- **Don't set `ALLOWED_ORIGINS=*` in production** — easy Canton data proxy
  for bots.
- **Don't deploy `bot.py` to Fly.io** — it lives in `canton-telegram-bot/`
  now and runs on your Mac.
- **Fly.io machine auto-stops if `min_machines_running` is unset** — our
  `fly.toml` pins it to 1, keeping the scheduler alive.

---

## LaunchAgent migration (optional, do AFTER web deploy works)

Once canton-hub is stable, switch your existing bot LaunchAgent over to
point at the new folder:

```bash
# 1. Stop the currently-loaded plist
launchctl unload ~/Library/LaunchAgents/com.cobling.canton-bot.plist

# 2. Update the paths inside it
sed -i '' \
  's|/canton-bot/|/canton-telegram-bot/|g' \
  ~/Library/LaunchAgents/com.cobling.canton-bot.plist

# 3. Copy your existing .env into canton-telegram-bot/
cp ~/project/Ozzycanton/canton-bot/.env \
   ~/project/Ozzycanton/canton-telegram-bot/.env

# 4. Create a fresh venv in canton-telegram-bot/
cd ~/project/Ozzycanton/canton-telegram-bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# 5. Test a manual run (preview mode, no telegram send)
TELEGRAM_BOT_TOKEN= python bot.py --now
# → should print a daily report to stdout

# 6. If step 5 looked good, reload the plist
launchctl load ~/Library/LaunchAgents/com.cobling.canton-bot.plist

# 7. Fire manually to verify end-to-end
launchctl kickstart gui/$(id -u)/com.cobling.canton-bot
tail -f ~/project/Ozzycanton/canton-telegram-bot/launchd_stdout.log
```

After a few days of successful runs from the new location, delete the old
`canton-bot/` folder.
