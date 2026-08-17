// scripts/scrape-benchlm.js
// BenchLM scraper — fetches the BenchLM leaderboard, validates the
// response shape, maps BenchLM display names to our curated keys via the
// alias table, and writes `benchlm: { score, verified, reliability, categories }`
// blocks back into data/models.json using the atomic write helper.
//
// Source: https://benchlm.ai/api/data/leaderboard?mode=bench-align-v5
// (JSON; falls back to --source file for fixtures).
//
// Schema (bench-align-v5.3, migrated 2026-08 — the old
// `/api/v1/rankings` endpoint now returns a Next.js 404):
//
//   {
//     lastUpdated, mode, methodologyVersion, sourceSnapshotId, approvedSnapshotId,
//     models: [{
//       rank,                       // integer
//       model,                      // display name, e.g. "Claude Fable 5"
//       creator, sourceType,        // metadata (unused)
//       overallScore,               // 0..100
//       categoryScores,             // { agentic, coding, reasoning, ... }
//       inputPrice, outputPrice,    // per-1M (unused — pricing is curated / other scrapers)
//       evidenceStatus,             // "supported" | "estimated"
//       methodologyVersion
//     }]
//   }
//
// Field mapping (new API → models.json `benchlm` block):
//   overallScore   → score        (clamped [0, 100])
//   evidenceStatus → verified     ("supported" → true, else false)
//                    evidence     (raw passthrough)
//                    reliability  (derived: supported → 0.75, estimated → 0.4)
//   categoryScores → categories   (direct rename, same shape)
//   rank           → rank
//
//   The bench-align-v5 API dropped the old per-model `reliability` field
//   (temporal score-consistency). We derive a coarse proxy from
//   `evidenceStatus` — the only evidence-quality signal the new API
//   exposes — and document it here so the 5-dot UI still renders.
//
// Conventions (matching the other scrapers):
//   - Atomic write via writeModelsJson (tmp + rename, see PR2 T2.1).
//   - Fail-loud on any unexpected shape; --dry-run reports diff without
//     touching the file. --file redirects the target (used by tests).
//   - Alias-miss is a WARN + skip (NOT fatal): the v5 leaderboard lists 50
//     models, many of which we do not track. Unknown display names are
//     logged loudly so a newly-published BenchLM model is visible without
//     blocking the whole refresh. Known-id-disappear stays a WARN (curated
//     record is preserved, no data is deleted).
//
// CLI:
//   node scripts/scrape-benchlm.js [--dry-run] [--file <path>]
//                                  [--source <url|file>] [--quiet]
//                                  [--alias <path>]

import {
  parseArgs,
  readModelsJson,
  writeModelsJson,
  fetchText,
  diffModels,
  summarizeDryRun,
  exitWith,
} from './_scraper-utils.mjs';
import { loadAliases, mapBenchlmId, detectMissing } from './_benchlm-safety.mjs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { existsSync, readFileSync as fsReadFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const SCRAPER_NAME = 'scrape-benchlm';
const SOURCE_URL = 'https://benchlm.ai/api/data/leaderboard?mode=bench-align-v5';
const DEFAULT_ALIAS_PATH = resolve(REPO_ROOT, 'data/benchlm-aliases.json');

/**
 * Return true when `src` looks like a local filesystem path rather than
 * an HTTP(S) URL. We treat any string without a `://` scheme as a path
 * candidate, and additionally support absolute Windows paths.
 *
 * @param {string} src
 * @returns {boolean}
 */
function isLocalPath(src) {
  if (!src) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src)) return false;
  return true;
}

/**
 * Clamp a BenchLM `overallScore` to [0, 100]. Returns null for non-finite
 * input so the renderer shows "unavailable" instead of a zero bar.
 *
 * @param {number} n
 * @returns {number|null}
 */
function clampScore(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/**
 * Build the BenchLM block for a single curated model from a new-schema
 * leaderboard record. Preserves `rank` and `evidenceStatus` while clamping
 * the score and deriving `verified` + `reliability`.
 *
 * @param {{overallScore: number, evidenceStatus: string, categoryScores?: Object, rank?: number}} r
 * @returns {{score: number|null, verified: boolean, reliability: number, categories: Object, rank?: number, evidence?: string}}
 */
function benchlmBlock(r) {
  const supported = r.evidenceStatus === 'supported';
  const block = {
    score: clampScore(r.overallScore),
    verified: supported,
    reliability: supported ? 0.75 : 0.4,
    categories: r.categoryScores && typeof r.categoryScores === 'object' ? r.categoryScores : {},
  };
  if (r.rank != null) block.rank = r.rank;
  if (r.evidenceStatus) block.evidence = r.evidenceStatus;
  return block;
}

/**
 * Core scrape logic. Exported for tests; the CLI wrapper at the bottom
 * of this file calls `runScrape(parseArgs(process.argv))` and translates
 * the result into `exitWith`.
 *
 * @param {{dryRun: boolean, file: string, source: string|null, quiet: boolean, aliasPath?: string}} args
 * @param {{fetchText?: (url: string, opts?: any) => Promise<string>}} [deps]
 * @returns {Promise<{ok: boolean, scraper: string, phase?: string, error?: string, changes?: number, missing?: string[], skipped?: string[], dryRun?: boolean}>}
 */
export async function runScrape(args, deps) {
  const fetchTextFn = (deps && deps.fetchText) || fetchText;
  const url = args.source || SOURCE_URL;
  const aliasPath = args.aliasPath || DEFAULT_ALIAS_PATH;

  // 1. Fetch (no cooldown — the cron handler enforces its own).
  //    When --source points at a local fixture path, read it directly
  //    so the CLI can be exercised without a live BenchLM endpoint.
  let text;
  try {
    if (isLocalPath(url)) {
      const localPath = isAbsolute(url) ? url : resolve(process.cwd(), url);
      if (!existsSync(localPath)) {
        return { scraper: SCRAPER_NAME, ok: false, phase: 'fetch', error: `local fixture not found: ${localPath}` };
      }
      text = fsReadFileSync(localPath, 'utf-8');
    } else {
      text = await fetchTextFn(url, { cooldownMs: 0 });
    }
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'fetch', error: err.message };
  }

  // 2. Parse JSON
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'parse', error: `response is not valid JSON: ${err.message}` };
  }

  // 3. Validate top-level shape: { models: [...] }
  if (!payload || !Array.isArray(payload.models)) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: 'response missing top-level `models` array' };
  }

  // 4. Validate each entry has model + overallScore + evidenceStatus
  //    (overallScore is a number, evidenceStatus is a non-empty string).
  for (let i = 0; i < payload.models.length; i++) {
    const r = payload.models[i];
    if (!r || typeof r !== 'object') {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `models[${i}] is not an object` };
    }
    if (typeof r.model !== 'string' || r.model.length === 0) {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `models[${i}].model is missing or empty` };
    }
    if (typeof r.overallScore !== 'number' || !Number.isFinite(r.overallScore)) {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `models[${i}].overallScore is missing or not a finite number (model=${r.model})` };
    }
    if (typeof r.evidenceStatus !== 'string' || r.evidenceStatus.length === 0) {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `models[${i}].evidenceStatus is missing or empty (model=${r.model})` };
    }
  }

  // 5. Load alias table
  let aliases;
  try {
    aliases = loadAliases(aliasPath);
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'alias', error: err.message };
  }

  // 6. Map BenchLM display names → curated keys. Unknown display names
  //    are WARN + skip (the v5 leaderboard lists models we do not track),
  //    NOT fatal. A genuinely malformed alias record still fails loud.
  const mappedPresent = new Set();
  const benchlmByKey = new Map();
  const skipped = [];
  for (const r of payload.models) {
    let curatedKey;
    try {
      curatedKey = mapBenchlmId(r.model, aliases);
    } catch (err) {
      if (err.code === 'BENCHLM_UNKNOWN_ID') {
        skipped.push(r.model);
        if (!args.quiet) {
          console.log(`[${SCRAPER_NAME}] warn: untracked BenchLM model "${r.model}" (rank ${r.rank}) — skipping (not in alias table)`);
        }
        continue;
      }
      return {
        scraper: SCRAPER_NAME,
        ok: false,
        phase: 'alias',
        error: err.message,
      };
    }
    mappedPresent.add(curatedKey);
    benchlmByKey.set(curatedKey, r);
  }

  // 7. Read existing data/models.json (or the --file override)
  let doc;
  try {
    doc = readModelsJson(args.file);
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'read', error: err.message };
  }

  // 8. Detect missing known ids (curated ids BenchLM did NOT mention).
  const knownIds = Object.keys(doc.models);
  const missing = detectMissing(knownIds, mappedPresent);

  // 9. Build the updated models object — only touch models that BenchLM
  //    listed. Curated fields (tier, isReference, notes, sources, pricing,
  //    rate limits) are preserved via spread.
  const before = JSON.parse(JSON.stringify(doc.models));
  const updatedModels = { ...doc.models };
  for (const [curatedKey, r] of benchlmByKey) {
    const existing = updatedModels[curatedKey];
    if (!existing) {
      // BenchLM mentioned a curated key we don't track. Log + skip so
      // a BenchLM addition doesn't blow up the run.
      if (!args.quiet) console.log(`[${SCRAPER_NAME}] note: curated key "${curatedKey}" is not tracked — skipping`);
      continue;
    }
    updatedModels[curatedKey] = { ...existing, benchlm: benchlmBlock(r) };
  }

  // 10. Log missing-known warnings
  if (!args.quiet) {
    for (const id of missing) {
      console.log(`[${SCRAPER_NAME}] warn: curated id "${id}" was not returned by BenchLM — preserving record`);
    }
  }

  const changes = diffModels(before, updatedModels);

  // 11. Dry-run path — parse + log, no write, no timestamp stamp.
  if (args.dryRun) {
    summarizeDryRun(SCRAPER_NAME, changes);
    return { scraper: SCRAPER_NAME, ok: true, dryRun: true, changes: changes.length, missing, skipped };
  }

  // 12. Stamp the BenchLM run timestamp on a successful fetch+parse+map.
  //     The composite-chart freshness badge reads _meta.scrapers.benchlm.lastRun
  //     (> 7 days → "stale"), so a successful scrape must advance it — even a
  //     no-op where scores happen to be unchanged.
  doc.models = updatedModels;
  doc._meta.scrapers = doc._meta.scrapers || {};
  doc._meta.scrapers.benchlm = doc._meta.scrapers.benchlm || {};
  doc._meta.scrapers.benchlm.lastRun = new Date().toISOString().slice(0, 10);

  if (changes.length === 0) {
    // No model data changed, but the successful scrape still advances the
    // freshness timestamp — persist it so the stale badge clears.
    try {
      writeModelsJson(args.file, doc, SCRAPER_NAME);
    } catch (err) {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'write', error: err.message };
    }
    if (!args.quiet) console.log(`[${SCRAPER_NAME}] no model changes — benchlm data up to date (lastRun stamped)`);
    return { scraper: SCRAPER_NAME, ok: true, changes: 0, missing, skipped };
  }

  // 13. Write atomically
  try {
    writeModelsJson(args.file, doc, SCRAPER_NAME);
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'write', error: err.message };
  }

  if (!args.quiet) {
    console.log(`[${SCRAPER_NAME}] wrote ${changes.length} change(s) — missing: ${missing.length}, skipped: ${skipped.length}`);
  }
  return { scraper: SCRAPER_NAME, ok: true, changes: changes.length, missing, skipped };
}

async function main() {
  const args = parseArgs(process.argv);
  // The CLI accepts --alias <path> via parseArgs' source flag pattern by
  // hijacking args.source OR by reading a second pass. Keep it simple:
  // --alias is read here directly (parseArgs does not know about it).
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--alias') {
      args.aliasPath = resolve(process.argv[++i]);
    }
  }
  const result = await runScrape(args);
  return exitWith(result.ok ? 0 : 1, result);
}

// Only invoke main when run directly (allows tests to import runScrape).
const invokedDirectly = (() => {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] || '');
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  main();
}
