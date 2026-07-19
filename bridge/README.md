# Coach bridge

A tiny local server that powers the app's AI coach using the **Max subscription** (via the
`claude` CLI), not the API. It streams chat replies and keeps **separate per-user memory**
(Caryn's notes never mix with Chris's). Workouts never depend on this being up; when it's
off, the app's coach tab just shows as offline.

Zero npm dependencies (uses Node's built-in http). Requires Node 18+ and an authenticated
`claude` CLI on the same machine.

## Endpoints
- `GET /health` -> `{ ok, model }`
- `POST /chat` `{ user, message }` -> streams the reply as plain text; saves history + extracts memory
- `POST /feedback` `{ user, session, streak }` -> `{ message }` short post-workout encouragement

## Run it
```bash
cp .env.example .env      # adjust if needed
./run.sh                  # or: node server.js
```
Then check: `curl localhost:8787/health`

Key `.env` values:
- `COACH_MODEL=claude-opus-4-8` (Opus, as requested)
- `CLAUDE_BIN=/Users/max/.local/bin/claude` (full path; needed under launchd)
- `ALLOWED_ORIGINS` browser origins allowed to call it
- `BRIDGE_TOKEN` optional shared token (sent as `x-bridge-token`)

## Keep it running (launchd)
Copy `com.trainer.coach.plist` to `~/Library/LaunchAgents/`, then:
```bash
launchctl load ~/Library/LaunchAgents/com.trainer.coach.plist
launchctl start com.trainer.coach
```
It restarts on crash and on login. Logs go to `/tmp/coach-bridge.log`.

## Expose to the app (so Caryn's phone can reach it)
The app is served at `https://trainer.azurecarson.com` (GitHub Pages, behind Cloudflare
Access). The bridge runs on this Mac, so it needs a public route.

**Recommended (secure, no token needed):** same-origin path routing so the app's own
Access session covers the bridge. Route `trainer.azurecarson.com/coach/*` to
`http://localhost:8787` (via a Cloudflare Worker or Tunnel public-hostname path), keeping it
under the same Access application. Then set in `config.js`:
```js
BRIDGE_URL: 'https://trainer.azurecarson.com/coach',
```
Because it's same-origin, the browser sends the Access cookie automatically and no bridge
token is required. (This is a Cloudflare change; hand it to the Azure Carson session.)

**Simpler alternative:** expose `coach.azurecarson.com` through the existing `azure` tunnel
(add an ingress rule to `~/.cloudflared/config.yml` + `cloudflared tunnel route dns azure
coach.azurecarson.com`). Note: config.js lives in a public repo, so a `BRIDGE_TOKEN` there is
not secret; prefer the same-origin approach for real protection.

After exposure, set `BRIDGE_URL` (and `BRIDGE_TOKEN` if used) in `config.js` and redeploy.
