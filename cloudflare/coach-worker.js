/**
 * Cloudflare Worker: same-origin coach proxy.
 *
 * Route: trainer.azurecarson.com/coach/*  ->  this Worker
 *
 * Why: the app is on GitHub Pages at trainer.azurecarson.com (behind the wildcard Access).
 * The coach bridge runs on Chris's Mac, exposed at coach.azurecarson.com (also Access-gated).
 * A browser on trainer.* cannot carry its login to coach.* (per-host Access cookies, iOS app
 * sandbox, ITP). Serving the coach at trainer.azurecarson.com/coach makes it SAME-ORIGIN, so the
 * browser's existing trainer login covers it automatically with no cookie seeding and no CORS.
 *
 * Flow:
 *   browser --(trainer Access cookie, same-origin)--> trainer.azurecarson.com/coach/*
 *     -> Access validates the browser (Chris/Caryn) -> this Worker runs
 *     -> Worker fetches coach.azurecarson.com/* with an Access SERVICE TOKEN (secrets below)
 *     -> coach Access validates the service token -> cloudflared tunnel -> bridge (localhost:8787)
 *     -> Worker streams the response straight back to the browser.
 *
 * Secrets (set with `wrangler secret put` or in the dashboard):
 *   COACH_CF_ACCESS_CLIENT_ID      - the service token Client ID for the coach Access app
 *   COACH_CF_ACCESS_CLIENT_SECRET  - the service token Client Secret
 *
 * The coach Access app must have a policy that INCLUDES this service token (Action: Service Auth),
 * in addition to the Chris + Caryn email policy.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/coach')) {
      return new Response('Not found', { status: 404 });
    }

    // /coach/chat -> /chat (the bridge also accepts the /coach prefix, so either is fine).
    const path = url.pathname.replace(/^\/coach/, '') || '/';
    const target = 'https://coach.azurecarson.com' + path + url.search;

    const headers = new Headers(request.headers);
    headers.set('CF-Access-Client-Id', env.COACH_CF_ACCESS_CLIENT_ID);
    headers.set('CF-Access-Client-Secret', env.COACH_CF_ACCESS_CLIENT_SECRET);
    headers.delete('host'); // let fetch set the correct Host for coach.azurecarson.com

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
      redirect: 'manual',
    });

    // Stream the response straight back (do not buffer, so tokens stream).
    const out = new Headers();
    const ct = upstream.headers.get('content-type');
    if (ct) out.set('content-type', ct);
    out.set('cache-control', 'no-store');
    out.set('x-accel-buffering', 'no');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
