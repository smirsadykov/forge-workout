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

  // RevenueCat public SDK keys — safe to commit, designed for client embed.
  // Get these from app.revenuecat.com → Project → API keys (NOT the secret
  // one — that's for server-side webhook on Supabase).
  // While empty, FORGE Pro runs in mock mode (paywall flips state locally
  // for testing). Once set, the SDK takes over on iOS/Android native builds.
  REVENUECAT_IOS_KEY: "",      // appl_xxxxxxxxxxxxxxx
  REVENUECAT_ANDROID_KEY: "",  // goog_xxxxxxxxxxxxxxx

  // Product IDs as configured in App Store Connect + Play Console.
  // Must match RevenueCat's product list one-to-one.
  REVENUECAT_PRODUCT_MONTHLY: "forge.pro.monthly",
  REVENUECAT_PRODUCT_YEARLY:  "forge.pro.yearly",
  // Entitlement identifier from RevenueCat dashboard → Entitlements.
  // Grants access when ANY of the products above is active.
  REVENUECAT_ENTITLEMENT: "pro",
};
