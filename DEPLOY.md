# Canton Hub Deployment Guide

Canton Hub is split into **two independent repos**:

```
~/project/Ozzycanton/
├── canton-hub/              ← THIS REPO — web dashboard
│   ├── api/                 ← FastAPI backend → Mac local (launchd)
│   ├── collectors/
│   ├── web/                 ← Next.js frontend → Vercel
│   └── scripts/             ← Cloudflare tunnel + Vercel env autoupdate
│
├── canton-telegram-bot/     ← SEPARATE REPO — daily telegram bot
│   ├── bot.py               ← Runs on home Mac via LaunchAgent
│   ├── formatter.py
│   ├── image_generator.py
│   └── collectors/
│
└── canton-bot/              ← LEGACY (currently active) — actual LaunchAgent
                               target as of 2026-04. Do not modify directly;
                               canton-telegram-bot is the intended successor
                               once the LaunchAgent is migrated.
```

This doc covers **canton-hub only**. The telegram bot is independent — see
`canton-telegram-bot/` for its own setup.

---

## Architecture (as-deployed)

```
┌──────────────────────┐     https      ┌──────────────────────────────────┐
│ web/ (Next.js)       │ ─────────────▶ │ Cloudflare Quick Tunnel          │
│ Vercel               │                │ *.trycloudflare.com (rotating)   │
│ canton-hub.          │                └────────────────┬─────────────────┘
│   vercel.app         │                                 │ localhost:8000
└──────────────────────┘                                 ▼
                                        ┌──────────────────────────────────┐
                                        │ api/ (FastAPI + APScheduler)     │
                                        │ Mac localhost — managed by       │
                                        │ launchd (com.cobling.canton-     │
                                        │ hub-backend)                     │
                                        │ + Playwright + collectors/*      │
                                        └──────────────────────────────────┘
```

### LaunchAgents (Mac)

| Agent | Purpose |
|---|---|
| `com.cobling.canton-hub-backend` | `uvicorn api.main:app --port 8000`, `KeepAlive=true` |
| `com.cobling.canton-hub-tunnel`  | `scripts/run-tunnel.sh` — spawns `cloudflared tunnel --url http://localhost:8000`, detects the generated `*.trycloudflare.com` URL, and on change invokes `scripts/update-vercel-env.sh` to replace Vercel's `NEXT_PUBLIC_API_URL` + trigger a redeploy. |
| `com.cobling.canton-bot`         | Telegram daily report (10:00 KST). Currently still targets `canton-bot/bot.py` (legacy). |

The Canton Hub backend is the only long-running data collection service.
The telegram bot (in `canton-telegram-bot/`) runs its own copy of collectors
once a day. They are intentionally decoupled — no API calls between them,
no shared state.

### Why not Fly.io?

Previously ran on `canton-api.fly.dev`. The Fly trial expired 2026-04 and
the app was destroyed (`fly apps destroy canton-api`). Going forward the
Mac-local + Cloudflare Quick Tunnel setup is the production path. Costs:
Vercel $0, tunnel $0, Mac always-on (~$1/mo power).

---

## Prerequisites

1. **Accounts**
   - Vercel: `npm i -g vercel && vercel login`
   - Cloudflare Quick Tunnel (no account needed — random URLs via `cloudflared`)
2. **Tools on Mac**
   - Python 3.12+ (`brew install python@3.12`)
   - `brew install cloudflared`
3. **Secrets** (local `.env` in `canton-hub/`)
   - `COINGECKO_API_KEY` — free Demo key
   - `RAPIDAPI_KEY` — Twitter API (Twttr API via `twitter241.p.rapidapi.com`)
   - `GITHUB_TOKEN` — read-only public_repo scope
   - (AI 요약·번역은 헤드리스 `claude -p`(Max 구독)라 `ANTHROPIC_API_KEY`/`DEEPL_API_KEY` 불필요 — 대신 Mac에 claude CLI 로그인 필요)
4. **Local `.env`** — `cp .env.example .env` and fill. Gitignored.

---

## Phase A — Backend (Mac local + launchd)

### A1. Install

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

### A2. Smoke test

```bash
cp .env.example .env
# edit .env with real values

uvicorn api.main:app --port 8000 --reload
# another terminal:
curl http://localhost:8000/api/health        # → {"status":"ok"}
curl http://localhost:8000/api/price         # → real price after ~30s
```

### A3. Install the LaunchAgent

`~/Library/LaunchAgents/com.cobling.canton-hub-backend.plist` should point
to `venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000`
with `KeepAlive=true`.

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.cobling.canton-hub-backend.plist
launchctl list | grep canton-hub-backend   # last exit should be 0
tail -f /tmp/canton-hub-backend.err.log
```

### A4. Applying code changes

`KeepAlive=true` means the same Python process persists for days. After
editing `api/scheduler.py` / `collectors/*.py` you MUST restart so imports
pick up the new code:

```bash
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend
```

---

## Phase B — Cloudflare Tunnel

The tunnel exposes `localhost:8000` over a public `*.trycloudflare.com` URL
and auto-updates Vercel's env var when the URL changes.

### B1. Install the wrapper

`~/Library/LaunchAgents/com.cobling.canton-hub-tunnel.plist` runs
`scripts/run-tunnel.sh`. Load:

```bash
launchctl load ~/Library/LaunchAgents/com.cobling.canton-hub-tunnel.plist
```

Wait ~30s, then:

```bash
cat /tmp/canton-hub-tunnel-url.txt
# → https://<random>.trycloudflare.com
curl "$(cat /tmp/canton-hub-tunnel-url.txt)/api/health"
# → {"status":"ok"}
```

### B2. Vercel env autoupdate

`scripts/update-vercel-env.sh` is invoked automatically by `run-tunnel.sh`
whenever the tunnel URL changes. It:

1. Removes the old `NEXT_PUBLIC_API_URL` production env
2. Adds the new URL
3. Triggers a Vercel production redeploy

If this ever fails manually:

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub/web
vercel env rm NEXT_PUBLIC_API_URL production --yes
printf '%s' "$(cat /tmp/canton-hub-tunnel-url.txt)" | vercel env add NEXT_PUBLIC_API_URL production
vercel --prod
```

---

## Phase C — Frontend (Vercel)

### C1. Initial setup (one time)

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub/web
vercel link            # link to existing `canton-hub` project
```

### C2. Deploy manually

```bash
vercel --prod --yes
```

Prints the prod URL (`https://canton-hub.vercel.app`). Tunnel URL changes
trigger this automatically.

### C3. Smoke test

- [ ] Dashboard loads with live price + B/M Ratio
- [ ] `/feed` shows Twitter archive
- [ ] `/analytics` shows arbitrage tracker + supply & burn table
- [ ] Dark/light theme toggle works
- [ ] DevTools Console → no red CORS errors

---

## Operations

### Backend restart

```bash
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend
```

### Tunnel restart (forces new URL + Vercel redeploy)

```bash
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-tunnel
```

### Force Vercel redeploy only

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub/web
vercel --prod --yes
```

### Force AI summary regeneration

The scheduler only calls Anthropic at KST 00:00 and 12:00. To bypass:

```bash
rm -f /Users/choejaewon/project/Ozzycanton/canton-hub/data/feed_summary.json
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend
# next collect_feed cycle (≤15 min) will regenerate
```

### Logs

| File | Contents |
|---|---|
| `/tmp/canton-hub-backend.err.log` | Python logger output (collectors, scheduler) |
| `/tmp/canton-hub-backend.out.log` | uvicorn HTTP access logs |
| `/tmp/canton-hub-tunnel.log` | cloudflared stdout/stderr |
| `/tmp/canton-hub-tunnel-wrapper.log` | run-tunnel.sh lifecycle (URL detection, Vercel updates) |

---

## Secrets reference

|                     | Mac `.env` | Vercel |
|---------------------|:----------:|:------:|
| COINGECKO_API_KEY   | ✅ | |
| RAPIDAPI_KEY        | ✅ | |
| GITHUB_TOKEN        | ✅ | |
| NEXT_PUBLIC_API_URL |    | ✅ (auto-managed by update-vercel-env.sh) |

> AI 요약·번역은 헤드리스 `claude -p`(Max 구독)로 동작 — `ANTHROPIC_API_KEY`/`DEEPL_API_KEY` 불필요(Mac에 claude CLI 로그인 필요).

## Cost estimate (monthly)

- Vercel: **$0** (Hobby tier)
- Cloudflare Quick Tunnel: **$0**
- Mac electricity: ~$1
- AI 요약·번역: **$0** (헤드리스 `claude -p` — Max 구독에 포함, 토큰 과금 없음)
- RapidAPI Twttr API (BASIC → PRO if needed): **$1–25**
- CoinGecko Demo: **$0**

## Pitfalls

- **Don't commit `.env`** — `.gitignore` excludes it.
- **Code edits don't take effect until LaunchAgent restart** — `KeepAlive`
  keeps the same Python process (and its cached imports) alive across days.
  Use `launchctl kickstart -k ...` after any backend edit.
- **Tunnel URL changes on every cloudflared restart** — but
  `update-vercel-env.sh` handles the Vercel env refresh + redeploy.
- **If `canton-hub.vercel.app` returns data from an old tunnel** — the env
  autoupdate may have failed. Check `/tmp/canton-hub-tunnel-wrapper.log`
  for `update-vercel-env` errors.
- **Mac asleep = service down** — if the Mac sleeps, the backend + tunnel
  stop. Set System Settings → Battery → Power Adapter → Prevent automatic
  sleeping. (Irrelevant for desktops.)

---

## LaunchAgent migration for the telegram bot (optional, future work)

As of 2026-04 the `com.cobling.canton-bot` LaunchAgent still targets
`canton-bot/bot.py` (the pre-split legacy folder). Both `canton-bot/` and
`canton-telegram-bot/` have the updated Twitter collector, so the daily
report works — but the docs assume the new path. Migrate when convenient:

```bash
# 1. Stop
launchctl unload ~/Library/LaunchAgents/com.cobling.canton-bot.plist

# 2. Point at canton-telegram-bot/
sed -i '' 's|/canton-bot/|/canton-telegram-bot/|g' \
  ~/Library/LaunchAgents/com.cobling.canton-bot.plist

# 3. Ensure .env + venv exist on target
cp ~/project/Ozzycanton/canton-bot/.env ~/project/Ozzycanton/canton-telegram-bot/.env
cd ~/project/Ozzycanton/canton-telegram-bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# 4. Dry run
TELEGRAM_BOT_TOKEN= python bot.py --now

# 5. Reload + kickstart
launchctl load ~/Library/LaunchAgents/com.cobling.canton-bot.plist
launchctl kickstart gui/$(id -u)/com.cobling.canton-bot
tail -f ~/project/Ozzycanton/canton-telegram-bot/launchd_stdout.log
```
