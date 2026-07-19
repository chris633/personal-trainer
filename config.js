/* Runtime configuration. Filled in during deploy.
   Safe to expose: the anon key and VAPID *public* key are public by design. */
window.APP_CONFIG = {
  // Supabase: stores push subscriptions + (later) synced progress.
  SUPABASE_URL: 'https://vchaofbvlpuaynhifurl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjaGFvZmJ2bHB1YXluaGlmdXJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NzQyMDksImV4cCI6MjEwMDA1MDIwOX0.RZrp1_ONVlMHr5P93FWHW6qMniP3r_wv1snpqWCpnV0',

  // Web Push: public VAPID key (base64url). Private key lives only on the server.
  VAPID_PUBLIC_KEY: 'BDunA2A2VKDfk16BdEbxk2rECLnnXe7jCbZGz1RYixUVch0KJcqN-_sbHILTPtyx3D52hQeTcejL6lpcPhhYURY',

  // Local Claude bridge (via cloudflared tunnel). Empty = AI features show as "offline".
  BRIDGE_URL: '',
  BRIDGE_TOKEN: '', // optional shared token sent as x-bridge-token (defense in depth behind Access)

  // Default profile when the app first opens.
  DEFAULT_USER: 'caryn',
};
