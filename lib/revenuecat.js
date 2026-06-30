// RevenueCat integration for FORGE Pro.
//
// Surfaces a tiny stable API to app.js:
//   - rcInit(userId)             — boot the SDK once we have a session
//   - rcGetOfferings()           — returns { monthly, yearly } package descriptors
//   - rcPurchase(plan)           — runs the native purchase sheet for "monthly" | "yearly"
//   - rcRestore()                — calls restorePurchases() on the SDK
//   - rcOnEntitlementChange(fn)  — fires whenever entitlement status flips
//
// The actual SDK only loads at native runtime (Capacitor.isNativePlatform()).
// On web we fall back to the existing Phase-1 mock so localhost dev still
// works — the rcInit() call simply returns false on web and the paywall
// continues to call mockSubscribe(). Switching is one branch in app.js.
//
// Phase 2 wiring:
//   1. `npm install` to pull @revenuecat/purchases-capacitor
//   2. `npx cap sync` after every code change
//   3. RevenueCat config keys live in window.FORGE_CONFIG (config.js)
//   4. Entitlement name "pro" gates everything; products are
//      forge.pro.monthly / forge.pro.yearly
//
// All functions are no-ops + log-only when keys / SDK are missing, so a
// half-configured build still launches without crashing.

(function () {
  // Track listeners + SDK availability without a top-level await.
  let sdk = null;                  // ESM module once dynamically imported
  let initialized = false;
  let initPromise = null;
  const entitlementListeners = new Set();

  function isNative() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function"
      && window.Capacitor.isNativePlatform());
  }

  function platformKey() {
    const cfg = window.FORGE_CONFIG || {};
    if (!window.Capacitor) return null;
    const plat = window.Capacitor.getPlatform?.();
    if (plat === "ios") return cfg.REVENUECAT_IOS_KEY || null;
    if (plat === "android") return cfg.REVENUECAT_ANDROID_KEY || null;
    return null;
  }

  // Dynamic import — bundled native build resolves this from node_modules
  // via Capacitor's web/native plugin loader. On web (where the import
  // would fail), we skip silently and let the caller fall back to mock.
  async function loadSdk() {
    if (sdk) return sdk;
    try {
      sdk = await import("@revenuecat/purchases-capacitor");
      return sdk;
    } catch (err) {
      console.warn("[FORGE/RC] SDK unavailable — falling back to mock.", err?.message || err);
      sdk = null;
      return null;
    }
  }

  // Boot the SDK. Idempotent — safe to call from login + every session
  // resume. Resolves to `true` when RC is live, `false` when we're on web
  // or keys are missing (caller stays in mock mode).
  window.rcInit = async function rcInit(userId) {
    if (!isNative()) return false;
    const key = platformKey();
    if (!key) {
      console.info("[FORGE/RC] No API key for this platform — staying in mock.");
      return false;
    }
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const mod = await loadSdk();
      if (!mod) return false;
      const Purchases = mod.Purchases || mod.default;
      try {
        if (!initialized) {
          await Purchases.configure({
            apiKey: key,
            appUserID: userId || null,
          });
          // Wire entitlement change → notify all listeners.
          await Purchases.addCustomerInfoUpdateListener?.((info) => {
            entitlementListeners.forEach(fn => {
              try { fn(parseEntitlement(info)); } catch (e) { console.error(e); }
            });
          });
          initialized = true;
        } else if (userId) {
          await Purchases.logIn({ appUserID: userId });
        }
        return true;
      } catch (err) {
        console.error("[FORGE/RC] Configure failed:", err);
        initPromise = null;  // allow retry next time
        return false;
      }
    })();
    return initPromise;
  };

  // Map RC customerInfo → simple shape used by app.js subscription helpers.
  function parseEntitlement(customerInfo) {
    const cfg = window.FORGE_CONFIG || {};
    const entId = cfg.REVENUECAT_ENTITLEMENT || "pro";
    const ent = customerInfo?.entitlements?.active?.[entId];
    if (!ent) return { status: "free", productId: null, expiresAt: null };
    const expiresAt = ent.expirationDate ? new Date(ent.expirationDate).getTime() : null;
    // periodType "INTRO" / "TRIAL" indicates trial; otherwise active paid.
    const isTrial = ent.periodType === "TRIAL" || ent.periodType === "INTRO";
    return {
      status: isTrial ? "trial" : "pro",
      productId: ent.productIdentifier || null,
      expiresAt,
    };
  }

  // Returns the offering's two packages keyed by our plan IDs.
  // Localized priceString comes pre-formatted from the SDK (e.g. "$4.99",
  // "299 ₽") — we surface it for the paywall to render natively.
  window.rcGetOfferings = async function rcGetOfferings() {
    if (!isNative()) return null;
    const mod = await loadSdk();
    if (!mod) return null;
    const Purchases = mod.Purchases || mod.default;
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings?.current;
      if (!current) return null;
      const out = { monthly: null, yearly: null };
      for (const pkg of current.availablePackages || []) {
        const id = pkg.product?.identifier;
        if (id === (window.FORGE_CONFIG?.REVENUECAT_PRODUCT_MONTHLY)) out.monthly = pkg;
        if (id === (window.FORGE_CONFIG?.REVENUECAT_PRODUCT_YEARLY))  out.yearly = pkg;
      }
      return out;
    } catch (err) {
      console.error("[FORGE/RC] getOfferings failed:", err);
      return null;
    }
  };

  // Runs the native purchase sheet. Returns the parsed entitlement on
  // success, or throws on user-cancel / failure (so the caller can keep
  // the paywall open with a toast).
  window.rcPurchase = async function rcPurchase(plan) {
    if (!isNative()) throw new Error("rc_not_native");
    const mod = await loadSdk();
    if (!mod) throw new Error("rc_sdk_unavailable");
    const Purchases = mod.Purchases || mod.default;
    const offerings = await window.rcGetOfferings();
    const pkg = plan === "monthly" ? offerings?.monthly : offerings?.yearly;
    if (!pkg) throw new Error("rc_package_missing");
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return parseEntitlement(customerInfo);
  };

  window.rcRestore = async function rcRestore() {
    if (!isNative()) return null;
    const mod = await loadSdk();
    if (!mod) return null;
    const Purchases = mod.Purchases || mod.default;
    const { customerInfo } = await Purchases.restorePurchases();
    return parseEntitlement(customerInfo);
  };

  // Listener registration. Returns an unsubscribe.
  window.rcOnEntitlementChange = function rcOnEntitlementChange(fn) {
    entitlementListeners.add(fn);
    return () => entitlementListeners.delete(fn);
  };

  // Expose isNative for app.js so it can pick mock vs real cleanly.
  window.rcIsAvailable = function rcIsAvailable() {
    return isNative() && !!platformKey();
  };
})();
