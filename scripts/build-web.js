// Build step for the Capacitor `webDir`. There's no bundler — we just mirror
// the runtime web files into dist/, which Capacitor copies into the native
// app on `cap sync`. Re-run with `npm run build:web` (or `npm run sync`).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "dist");

// Files + dirs the running app actually needs (tests/, scripts/, docs excluded).
const FILES = [
  "index.html", "app.js", "i18n.js", "exercises.js", "config.js",
  "styles.css", "supabase.min.js", "sw.js", "manifest.json", "icon.svg",
];
const DIRS = ["lib", "assets"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let copied = 0;
for (const f of FILES) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(out, f)); copied++; }
  else console.warn("build-web: missing file", f);
}
for (const d of DIRS) {
  const src = path.join(root, d);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, d), { recursive: true });
}

console.log(`build-web: dist/ ready — ${copied} files + [${DIRS.join(", ")}]`);
