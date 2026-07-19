/* Runtime configuration. Filled in during deploy.
   Safe to expose: the anon key and VAPID *public* key are public by design. */
window.APP_CONFIG = {
  // Supabase — stores push subscriptions + (later) synced progress.
  SUPABASE_URL: '',        // e.g. https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',

  // Web Push — public VAPID key (base64url). Private key lives only on the server.
  VAPID_PUBLIC_KEY: '',

  // Local Claude bridge (via cloudflared tunnel). Empty = AI features show as "offline".
  BRIDGE_URL: '',

  // Default profile when the app first opens.
  DEFAULT_USER: 'caryn',
};
