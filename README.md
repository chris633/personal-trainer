# Trainer

A personal-training PWA. Daily workouts, tap-to-check-off with celebrations, streaks,
6:15am push reminders on workout days, and an AI coach that plans and encourages.

- **Frontend**: static PWA (this repo) → GitHub Pages → `trainer.azurecarson.com`
- **Backend**: Supabase (push subscriptions, progress sync, scheduled 6:15am reminder)
- **AI**: local Claude bridge (uses the Max subscription, not the API) exposed via cloudflared

Per-user by design: each person (Caryn, Chris) has their own program, progress, streak,
and coach memory — no overlap.

## Structure
- `index.html`, `styles.css`, `app.js` — the app
- `data.js` — the program (source of truth for scheduled workouts)
- `config.js` — public runtime config (Supabase URL/anon key, VAPID public key, bridge URL)
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA shell
- `bridge/` — local Claude coach server (added this week)

## Deploy
Push to `main`; GitHub Pages serves the root. Bump `CACHE` in `sw.js` when assets change.
