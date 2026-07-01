// FORGE configuration.
//
// To enable cloud backend (multi-device sync, real auth):
//   1. Follow SUPABASE-SETUP.md to create a free Supabase project
//   2. Paste your Project URL + anon key below
//   3. Commit + push
//
// While these strings are empty, FORGE runs in local-only mode
// (data lives in this browser's localStorage). Existing local accounts
// continue to work.
window.FORGE_CONFIG = {
  SUPABASE_URL: "https://bdokozyonhzluyhztynj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkb2tvenlvbmh6bHV5aHp0eW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTA3ODQsImV4cCI6MjA5NTMyNjc4NH0.Ulmnycboxxz5wp_kBYooK5IQoUB9EnNgW67J-DxCY4k",

  // RevenueCat public Google Play API key (Project → API keys → Google Play).
  // Safe to ship in-client (it's a public SDK key). Empty = billing disabled
  // (paywall still shows; purchase falls back to "use the mobile app").
  REVENUECAT_API_KEY: "",
};
