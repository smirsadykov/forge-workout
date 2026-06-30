// Capacitor native integration. This file is a NO-OP on the web build —
// `window.Capacitor` only exists inside the native app, so the guard below
// returns early in a normal browser. Loaded after app.js in index.html.
(function () {
  var Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) return;
  var P = Cap.Plugins || {};

  // ── Status bar ── dark style (light icons) over the near-black FORGE bg.
  if (P.StatusBar) {
    try { P.StatusBar.setStyle({ style: "DARK" }); } catch (e) {}
    try { P.StatusBar.setBackgroundColor({ color: "#0d0f15" }); } catch (e) {}
  }

  // ── Hardware back button ── close an open modal/sheet first; else step back
  // in history; else background the app. Never hard-exit mid-session.
  if (P.App && P.App.addListener) {
    P.App.addListener("backButton", function (info) {
      var openModal = document.querySelector(
        ".modal:not(.hidden), .sheet.open, .bottom-sheet.open, #onboardModal:not(.hidden)"
      );
      if (openModal) {
        var close = openModal.querySelector(
          "[data-action='close'], .modal-close, .sheet-close, [data-onboard-action='skip'], .link-btn"
        );
        if (close) { close.click(); return; }
      }
      if (info && info.canGoBack) { window.history.back(); }
      else if (P.App.minimizeApp) { P.App.minimizeApp(); }
    });
  }

  // ── External links ── exercise-demo links etc. open in the system browser
  // instead of replacing the app's WebView. Capture-phase + delegated so it
  // catches dynamically-rendered cards.
  if (P.Browser) {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="http"]') : null;
      if (!a) return;
      e.preventDefault();
      P.Browser.open({ url: a.href }).catch(function () {});
    }, true);
  }
})();
