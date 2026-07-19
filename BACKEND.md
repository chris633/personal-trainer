# Backend (Supabase — project `trainer`)

Isolated Supabase project, **separate from Varde**.

- **Project ref**: `vchaofbvlpuaynhifurl`
- **URL**: `https://vchaofbvlpuaynhifurl.supabase.co`
- **Anon key**: in `config.js` (public, safe to expose)

## Tables
- `push_subscriptions (user_id, endpoint unique, subscription jsonb)` — one row per device.
- `completions (user_id, date unique-per-user, focus)` — completed sessions (cross-device + coach memory).
- `reminder_log (user_id, date)` — dedupe so a reminder fires once per user per day.

RLS: anon may insert/update its own subscription and log completions; `reminder_log` is
service-role only. The edge function uses the service role (bypasses RLS).

## Edge function: `send-reminder`
- **Test**: `POST { "test": true, "user_id": "caryn" }` → sends a test push immediately.
- **Scheduled**: empty body → only sends inside the 6:15–6:24am America/New_York window,
  to any user with a workout that date, deduped via `reminder_log`. `{ "force": true }`
  bypasses the time/dedupe gate for testing the real message.
- VAPID keys are inlined in the deployed function only (private key is **not** in this repo).
  Regenerate with `npx web-push generate-vapid-keys`; update the function + `VAPID_PUBLIC_KEY`.
- The workout schedule is embedded in the function (`SCHEDULE`). Regenerate from `data.js`
  and redeploy when the plan changes (or move to a DB table when the AI bridge lands).

## Cron
`cron.job` `workout-morning-reminder`: `*/5 9-12 * * 1,3,5` (UTC) → `net.http_post` to the
function. Wide UTC window + in-function local-time gate makes it DST-proof.
