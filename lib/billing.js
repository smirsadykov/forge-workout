// ═════════════════════════════════════════════════════════════════════════
// FORGE billing — RevenueCat (Capacitor) integration.
//
// This file owns purchases. It exposes a small global API that the app (a
// separate script scope) calls:
//   window.FORGE_purchase(plan)      plan = "annual" | "monthly" | "lifetime"
//   window.FORGE_restore()
//   window.FORGE_billingIdentify()   re-identify the signed-in user
//
// It flips premium on/off via window.FORGE_setPremium(bool), defined in app.js.
//
// On the WEB build there's no native billing — purchase/restore tell the user
// to use the mobile app, so the paywall is still fully testable in a browser.
//
// On NATIVE we talk to the RevenueCat Capacitor plugin through the Capacitor
// bridge (no bundler in this project, so we use Capacitor.Plugins directly).
// Product/entitlement setup lives in: Main vault / FORGE + STORE-LISTING.md.
// ═════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  var ENTITLEMENT = "premium";
  // RevenueCat package identifiers → our plan keys. Configure the matching
  // packages in the RevenueCat "default" offering.
  var PLAN_TO_PACKAGE = { annual: "$rc_annual", monthly: "$rc_monthly", lifetime: "$rc_lifetime" };

  function cfg() { return (window.FORGE_CONFIG || {}); }
  function t(key, fallback) {
    try { return (window.t ? window.t(key) : null) || fallback; } catch (e) { return fallback; }
  }
  function toast(msg, kind) {
    if (window.FORGE_toast) window.FORGE_toast(msg, { kind: kind || "info" });
  }
  function isNative() {
    var C = window.Capacitor;
    return !!(C && typeof C.isNativePlatform === "function" && C.isNativePlatform());
  }
  // Raw plugin bridge for @revenuecat/purchases-capacitor.
  function rc() {
    var C = window.Capacitor;
    return (C && C.Plugins && (C.Plugins.PurchasesPlugin || C.Plugins.Purchases)) || null;
  }

  var configured = false;
  var offeringsCache = null;

  async function ensureConfigured() {
    if (configured) return true;
    var plugin = rc();
    var apiKey = cfg().REVENUECAT_API_KEY;
    if (!plugin || !apiKey) return false;
    var appUserID = (window.FORGE_getUserId && window.FORGE_getUserId()) || null;
    try {
      await plugin.configure({ apiKey: apiKey, appUserID: appUserID || undefined });
      configured = true;
      // React to entitlement changes pushed by the store / restores.
      try {
        plugin.addListener("customerInfoUpdate", function (info) { applyCustomerInfo(info); });
      } catch (e) {}
      await refreshOfferings();
      await refreshEntitlement();
      return true;
    } catch (e) {
      console.warn("[forge-billing] configure failed:", e);
      return false;
    }
  }

  function applyCustomerInfo(info) {
    try {
      var ent = info && info.entitlements && info.entitlements.active;
      var active = !!(ent && ent[ENTITLEMENT]);
      if (window.FORGE_setPremium) window.FORGE_setPremium(active);
    } catch (e) {}
  }

  async function refreshEntitlement() {
    var plugin = rc();
    if (!plugin) return;
    try {
      var res = await plugin.getCustomerInfo();
      applyCustomerInfo(res && res.customerInfo ? res.customerInfo : res);
    } catch (e) {}
  }

  async function refreshOfferings() {
    var plugin = rc();
    if (!plugin) return;
    try {
      var res = await plugin.getOfferings();
      var current = res && (res.current || (res.all && res.all["default"]));
      if (!current) return;
      offeringsCache = current;
      // Update the paywall's displayed (localized) prices from the store.
      (current.availablePackages || []).forEach(function (pkg) {
        var price = pkg.product && (pkg.product.priceString || pkg.product.price_string);
        var id = (pkg.identifier || "").toLowerCase();
        if (!price) return;
        if (id.indexOf("annual") >= 0) setText("priceAnnual", price);
        else if (id.indexOf("month") >= 0) setText("priceMonthly", price);
        else if (id.indexOf("lifetime") >= 0) setText("priceLifetime", price);
      });
    } catch (e) {}
  }

  function setText(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }

  function findPackage(plan) {
    if (!offeringsCache) return null;
    var pkgs = offeringsCache.availablePackages || [];
    var wantId = PLAN_TO_PACKAGE[plan];
    // Try exact RC identifier, then a fuzzy match on the plan word.
    return pkgs.find(function (p) { return p.identifier === wantId; }) ||
           pkgs.find(function (p) { return (p.identifier || "").toLowerCase().indexOf(plan) >= 0; }) ||
           null;
  }

  // ── Public API ─────────────────────────────────────────────────────────
  window.FORGE_purchase = async function (plan) {
    if (!isNative()) { toast(t("paywall.notAvailableWeb", "Purchases are available in the FORGE mobile app."), "info"); return; }
    var ok = await ensureConfigured();
    var plugin = rc();
    if (!ok || !plugin) { toast(t("paywall.purchaseError", "Purchase could not be completed. Please try again."), "error"); return; }
    var pkg = findPackage(plan);
    if (!pkg) { toast(t("paywall.purchaseError", "Purchase could not be completed. Please try again."), "error"); return; }
    try {
      var res = await plugin.purchasePackage({ aPackage: pkg });
      applyCustomerInfo(res && res.customerInfo ? res.customerInfo : res);
      if (window.FORGE_isPremium && window.FORGE_isPremium()) {
        toast(t("paywall.purchaseSuccess", "Premium unlocked. Enjoy!"), "success");
        if (window.FORGE_closePaywall) window.FORGE_closePaywall();
      }
    } catch (e) {
      // User-cancelled is not an error worth shouting about.
      if (e && (e.code === "1" || e.userCancelled || e.code === "PURCHASE_CANCELLED")) return;
      console.warn("[forge-billing] purchase failed:", e);
      toast(t("paywall.purchaseError", "Purchase could not be completed. Please try again."), "error");
    }
  };

  window.FORGE_restore = async function () {
    if (!isNative()) { toast(t("paywall.notAvailableWeb", "Purchases are available in the FORGE mobile app."), "info"); return; }
    var ok = await ensureConfigured();
    var plugin = rc();
    if (!ok || !plugin) { toast(t("paywall.purchaseError", "Purchase could not be completed. Please try again."), "error"); return; }
    try {
      var res = await plugin.restorePurchases();
      applyCustomerInfo(res && res.customerInfo ? res.customerInfo : res);
      if (window.FORGE_isPremium && window.FORGE_isPremium()) {
        toast(t("paywall.purchaseSuccess", "Premium unlocked. Enjoy!"), "success");
        if (window.FORGE_closePaywall) window.FORGE_closePaywall();
      } else {
        toast(t("paywall.restoreNone", "No purchases found to restore."), "info");
      }
    } catch (e) {
      toast(t("paywall.purchaseError", "Purchase could not be completed. Please try again."), "error");
    }
  };

  // Re-identify the signed-in user so entitlements follow them across devices.
  window.FORGE_billingIdentify = async function () {
    if (!isNative()) return;
    var plugin = rc();
    var uid = (window.FORGE_getUserId && window.FORGE_getUserId()) || null;
    if (!configured) { await ensureConfigured(); }
    if (!plugin || !uid) return;
    try { await plugin.logIn({ appUserID: uid }); await refreshEntitlement(); } catch (e) {}
  };

  // Configure on native at startup (also refreshes offerings + entitlement).
  if (isNative()) {
    document.addEventListener("DOMContentLoaded", function () { ensureConfigured(); });
  }
})();
