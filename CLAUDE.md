# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deploy

```bash
# Deploy to Railway (always specify service to avoid ambiguity)
railway up --service vigilant-forgiveness

# Push to GitHub (Railway may auto-deploy from main)
git push origin main
```

Railway project: `fe3481e0-ab5c-46e1-b9eb-640811730d88`
Live URL: `https://vigilant-forgiveness-production-6c0f.up.railway.app`

## Run locally

```bash
node server.js   # starts on PORT env var or 3000
```

No build step — plain Node.js + static files served from the same directory.

## Architecture

Two separate Railway services work together:

| Service | Repo | Purpose |
|---------|------|---------|
| `vigilant-forgiveness` | `war-monitor` (this repo) | Public dashboard + all APIs |
| `stellar-courtesy` | `agent_system` | Python agents, Telegram alerts |

**They are intentionally independent.** `war-monitor` does not call `agent_system`'s API. Each has its own RSS scanner and in-memory state that resets on deploy.

### war-monitor (Node.js)

- `server.js` — Express server. All `/api/*` routes live here. Scans RSS feeds every 2 min for missile events, stores in `missileEvents[]` (in-memory, resets on restart). Also fetches BTC (Binance), market data (Yahoo Finance), Fear & Greed (alternative.me), and GNews.
- `app.js` — Client-side JS. Fetches all data from `/api/*` routes (never calls external APIs directly). Updates DOM for prices, missile alerts, Fear & Greed gauge, news cards.
- `map.js` — Leaflet.js conflict map. Animates ONLY live RSS-detected events — the historical-strike replay loop was removed at user request (July 2026); the map is intentionally quiet between detections. `fetchLiveMissileAlerts()` polls `/api/missile-alerts?since=` every 30s.
- `index.html` / `style.css` — Static dashboard UI.

### Key API endpoints

| Endpoint | Source | Cache |
|----------|--------|-------|
| `/api/btc` | Binance | none |
| `/api/market?ticker=` | Yahoo Finance | none |
| `/api/fear-greed` | alternative.me | none |
| `/api/news` | GNews | 4h |
| `/api/events` | GNews | 4h |
| `/api/missile-alerts?since=` | In-memory RSS scan | none |
| `/api/missile-debug` | In-memory RSS scan | none |
| `/api/war-status` | GNews scan | 4h |

### RSS Feeds (missile tracker)

Times of Israel, BBC World, Jerusalem Post — confirmed accessible from Railway. Reuters/CNN/Al Jazeera are blocked from Railway servers.

### Telegram

`server.js` does NOT send Telegram messages — that is handled exclusively by `agent_system/war_telegram_agent.py` and `war_missile_tracker_agent.py` to avoid duplicate messages.

### Map color convention

- 🔴 Red `#f85149` — Iran / IRGC missiles
- 🟢 Green `#3fb950` — Israel / IDF airstrikes
- 🔵 Blue `#58a6ff` — US Forces
- 🟠 Orange-red `#ff6b35` — Houthi / Yemen
- 🟧 Orange `#e3693a` — Hezbollah

### Known gotchas

- `missileIcon()` exists in both `app.js` (returns emoji string) and `map.js` (returns Leaflet DivIcon). The app.js version is named `missileEmoji()` to avoid collision.
- Strike counters (`total-launched`, `total-intercepted`) are set by `fetchMissileAlerts()` only — do not add competing `animateCounter()` calls in `DOMContentLoaded` for these elements.
- `arcPath()` bows perpendicular to the flight path (min 0.4°, max 5.5°) — never a fixed northward bow, which made short southward arcs (Lebanon→Israel) loop backward over their launch point.
- GNews API key is server-side only (`process.env.GNEWS_API_KEY`). Client never calls GNews directly.
