// scripts/_scraper-utils.mjs
// Shared utilities for the 6 GitHub Actions scrapers.
//
// Conventions (per design.md + spec.md "Auto-Sync"):
//   - Each scraper is a standalone Node script (Node 18+, native fetch).
//   - Reads data/models.json from the repo root.
//   - Writes back ONLY the fields it manages (no destructive full-rewrites).
//   - Emits a "patch" object that the orchestrator can apply.
//   - Honors --dry-run: parse + log without writing.
//
// All helpers are defensive — when the upstream HTML changes (and the
// parse fails), the scraper exits with a non-zero code and a clear
// message so the GitHub Actions step fails loud.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

/**
 * Default path to the models.json file (the data layer).
 * Override with `--file <path>` for tests.
 */
export const MODELS_JSON_PATH = resolve(REPO_ROOT, 'data/models.json');

/**
 * Parse CLI flags. Recognized:
 *   --dry-run          : parse + log, do NOT write
 *   --file <path>      : override models.json path
 *   --source <url>     : override upstream URL (used for tests + Arena/GLM)
 *   --quiet            : suppress non-error logs
 *
 * @param {string[]} argv
 * @returns {{dryRun: boolean, file: string, source: string|null, quiet: boolean}}
 */
export function parseArgs(argv) {
  const out = { dryRun: false, file: MODELS_JSON_PATH, source: null, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--quiet') out.quiet = true;
    else if (arg === '--file') out.file = resolve(argv[++i]);
    else if (arg === '--source') out.source = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scrape-X.js [--dry-run] [--file <path>] [--source <url>] [--quiet]');
      process.exit(0);
    }
  }
  return out;
}

/**
 * Read + parse `data/models.json`. Returns the full document (with _meta
 * + models). Throws if the file is missing or malformed.
 *
 * @param {string} path
 * @returns {{_meta: Object, models: Object<string, Object>}}
 */
export function readModelsJson(path) {
  if (!existsSync(path)) {
    throw new Error(`models.json not found at ${path}`);
  }
  const raw = readFileSync(path, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`models.json is not valid JSON (${err.message})`);
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.models || typeof parsed.models !== 'object') {
    throw new Error('models.json missing top-level `models` object');
  }
  return parsed;
}

/**
 * Write back the updated models.json document.
 *  - Updates `_meta.lastSynced` to today (UTC ISO date).
 *  - Migrates legacy `_meta.source` (string) into `_meta.sources` (array)
 *    on first write, then APPENDS the current scraper tag to the array
 *    while deduping. The plural `_meta.sources` shape is canonical;
 *    `_meta.source` is always removed on write.
 *  - Bumps `_meta.schemaVersion` only when the shape changes (we leave it
 *    unchanged for normal price/benchmark refreshes — schema bumps
 *    invalidate every cached entry in production).
 *
 * @param {string} path
 * @param {{_meta: Object, models: Object}} doc
 * @param {string} sourceTag - appended to _meta.sources for audit trail
 * @returns {void}
 */
export function writeModelsJson(path, doc, sourceTag) {
  const today = new Date().toISOString().slice(0, 10);
  doc._meta = doc._meta || {};

  // --- _meta.sources migration -----------------------------------------
  // Canonical shape is _meta.sources: string[]. We accept (in priority
  // order) an existing array, a legacy single string, or nothing — and
  // always emit the plural array. The current run tag is appended (or
  // 'auto-sync' when no tag is provided), and duplicates are skipped so
  // repeated scraper runs preserve history without growth.
  let sources = [];
  if (Array.isArray(doc._meta.sources)) {
    sources = doc._meta.sources.filter((s) => typeof s === 'string' && s.length > 0);
  } else if (typeof doc._meta.source === 'string' && doc._meta.source.length > 0) {
    sources = [doc._meta.source];
  }
  const tag = sourceTag || 'auto-sync';
  if (!sources.includes(tag)) {
    sources.push(tag);
  }
  doc._meta.sources = sources;
  delete doc._meta.source;
  // ---------------------------------------------------------------------

  doc._meta.lastSynced = today;
  // nextSync = today + 5 days (cron schedule)
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 5);
  doc._meta.nextSync = next.toISOString().slice(0, 10);
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
}

/**
 * Strip HTML tags from a string and collapse whitespace. Used by
 * scrapers that get a text snippet from a markdown blog and need to
 * regex numbers out of it.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Default cooldown between HTTP requests, in milliseconds. The jitter
 * (500 ms) spreads scrapers across the cron window so 6 scrapers firing
 * at the same moment don't hit upstream at once. Range: 1000–1500 ms.
 *
 * Polite to upstream (OpenAI pricing page, Anthropic, LMArena, etc.) —
 * the prior T7 advisory noted that the OpenAI page in particular was
 * seeing bursts of scraper traffic without spacing.
 *
 * Honor per-call override via `options.cooldownMs` (set to 0 to skip).
 */
const DEFAULT_COOLDOWN_MS = 1000;
const COOLDOWN_JITTER_MS = 500;

/**
 * Fetch a URL and return the response text. Throws on non-2xx with a
 * descriptive error. Uses the global `fetch` (Node 18+).
 *
 * Politespace between calls via a randomized cooldown (~1.0–1.5 s) so
 * upstream providers (OpenAI, Anthropic, LMArena, etc.) don't see
 * bursts of scraper traffic. Override with `options.cooldownMs: 0` to
 * skip (used by tests).
 *
 * @param {string} url
 * @param {{timeoutMs?: number, cooldownMs?: number}} [options]
 * @returns {Promise<string>}
 */
export async function fetchText(url, options) {
  const opts = options || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 30000);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'sdd-agent-selector-sync/1.0 (+https://github.com/Teksi75/sdd_agent_selector)' } });
    if (!r.ok) {
      throw new Error(`fetch ${url} → HTTP ${r.status} ${r.statusText}`);
    }
    return await r.text();
  } finally {
    clearTimeout(timer);
    // Politeness cooldown: wait 1.0–1.5 s (jittered) before returning
    // so callers chained in the cron workflow don't hammer upstream.
    const cooldownMs = Number.isFinite(opts.cooldownMs) ? opts.cooldownMs : DEFAULT_COOLDOWN_MS;
    if (cooldownMs > 0) {
      const wait = cooldownMs + Math.floor(Math.random() * COOLDOWN_JITTER_MS);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

/**
 * Parse a number-like string: "$1.40", "1,234", "62.1", "$0.0028", "-".
 * Returns NaN for inputs that cannot be parsed (the caller decides how
 * to react). Dashes, blanks, and "n/a" return NaN.
 *
 * @param {string} raw
 * @returns {number}
 */
export function parsePrice(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—' || s.toLowerCase() === 'n/a') return NaN;
  // Remove $, commas, whitespace.
  const cleaned = s.replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Compute the diff between two models objects. Used by --dry-run to
 * report what would change without writing.
 *
 * @param {Object<string, Object>} before
 * @param {Object<string, Object>} after
 * @returns {Array<{key: string, field: string, from: any, to: any}>}
 */
export function diffModels(before, after) {
  const changes = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    const b = before?.[key] || {};
    const a = after?.[key] || {};
    const allFields = new Set([...Object.keys(b), ...Object.keys(a)]);
    for (const f of allFields) {
      const bv = b[f];
      const av = a[f];
      if (JSON.stringify(bv) !== JSON.stringify(av)) {
        changes.push({ key, field: f, from: bv, to: av });
      }
    }
  }
  return changes;
}

/**
 * Log + exit helper. Writes a JSON-line summary to stderr (so the GH
 * Actions log captures it) and exits with the given code.
 *
 * @param {number} code
 * @param {Object} summary
 * @returns {never}
 */
export function exitWith(code, summary) {
  process.stderr.write(JSON.stringify(summary) + '\n');
  process.exit(code);
}

/**
 * Print a one-line summary of a patch in dry-run mode.
 *
 * @param {string} scraperName
 * @param {Array<{key: string, field: string, from: any, to: any}>} changes
 */
export function summarizeDryRun(scraperName, changes) {
  if (changes.length === 0) {
    console.log(`[${scraperName}] dry-run: no changes detected`);
    return;
  }
  console.log(`[${scraperName}] dry-run: ${changes.length} change(s) would be applied`);
  for (const c of changes.slice(0, 30)) {
    console.log(`  ${c.key}.${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
  }
  if (changes.length > 30) {
    console.log(`  ... and ${changes.length - 30} more`);
  }
}