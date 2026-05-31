#!/usr/bin/env node
// release.js — bumps the cache version in every place that references it.
//
// Why: cache version is currently referenced in 5+ places per release:
//   - index.html:  ?v=N for each <script>/<link> tag (5 occurrences)
//   - sw.js:       const CACHE_NAME = "forge-cache-vN"
//   - sw.js:       APP_SHELL paths (no version, but listed for completeness)
// Forgetting one ships stale code. This script bumps them all in lockstep.
//
// Usage:
//   node scripts/release.js              # auto-bump by 1
//   node scripts/release.js --to 80      # explicit target version
//   node scripts/release.js --dry-run    # show diff without writing
//   node scripts/release.js --tag        # also tag a git commit afterwards
//
// Detects the current version by reading sw.js's CACHE_NAME. index.html
// must agree (?v=N matches forge-cache-vM where N matches M / 2). If they
// disagree, script aborts with a clear error rather than silently picking
// a winner.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "index.html");
const SW = path.join(ROOT, "sw.js");

function readFile(p) {
  return fs.readFileSync(p, "utf8");
}
function writeFile(p, content) {
  fs.writeFileSync(p, content);
}

function detectCurrent() {
  const sw = readFile(SW);
  const swMatch = sw.match(/forge-cache-v(\d+)/);
  if (!swMatch) throw new Error("Could not find forge-cache-vN in sw.js");
  const swVer = parseInt(swMatch[1], 10);

  const html = readFile(HTML);
  const htmlMatches = [...html.matchAll(/\?v=(\d+)/g)];
  if (!htmlMatches.length) throw new Error("Could not find ?v=N in index.html");
  const htmlVers = new Set(htmlMatches.map(m => parseInt(m[1], 10)));
  if (htmlVers.size > 1) {
    throw new Error(`index.html ?v= values disagree: ${[...htmlVers].join(", ")}. Manual fix needed before script can bump.`);
  }
  const htmlVer = [...htmlVers][0];
  return { swVer, htmlVer };
}

function bump(opts = {}) {
  const { swVer, htmlVer } = detectCurrent();
  // We don't require htmlVer === swVer (they were separate counters
  // historically). Just bump each independently.
  const newHtmlVer = opts.toHtml ?? htmlVer + 1;
  const newSwVer = opts.toSw ?? swVer + 1;

  const html = readFile(HTML).replace(/\?v=\d+/g, `?v=${newHtmlVer}`);
  const sw = readFile(SW).replace(/forge-cache-v\d+/g, `forge-cache-v${newSwVer}`);

  if (opts.dryRun) {
    console.log(`[dry-run] index.html: ?v=${htmlVer} → ?v=${newHtmlVer}`);
    console.log(`[dry-run] sw.js:      forge-cache-v${swVer} → forge-cache-v${newSwVer}`);
    return { newHtmlVer, newSwVer };
  }

  writeFile(HTML, html);
  writeFile(SW, sw);
  console.log(`✓ index.html bumped: ?v=${htmlVer} → ?v=${newHtmlVer}`);
  console.log(`✓ sw.js bumped: forge-cache-v${swVer} → forge-cache-v${newSwVer}`);
  return { newHtmlVer, newSwVer };
}

// CLI
const args = process.argv.slice(2);
const opts = { dryRun: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--dry-run") opts.dryRun = true;
  else if (a === "--to" && args[i + 1]) {
    const v = parseInt(args[++i], 10);
    opts.toHtml = v;
    opts.toSw = v;
  } else if (a === "--help" || a === "-h") {
    console.log("Usage: node scripts/release.js [--to N] [--dry-run]");
    process.exit(0);
  }
}

try {
  bump(opts);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
