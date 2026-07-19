// scripts/scrape-benchlm.js
// BenchLM scraper — fetches the BenchLM rankings, validates the
// response shape, maps BenchLM ids to our curated keys via the alias
// table, and writes `benchlm: { score, verified, reliability, categories }`
// blocks back into data/models.json using the atomic write helper.
//
// Source: https://benchlm.ai/api/v1/rankings (JSON; falls back to --source
// file for fixtures).
//
// Conventions (matching the other 6 scrapers):
//   - Atomic write via writeModelsJson (tmp + rename, see PR2 T2.1).
//   - Fail-loud on any unexpected shape; --dry-run reports diff without
//     touching the file. --file redirects the target (used by tests).
//   - Alias-miss is FATAL (unknown BenchLM id exits non-zero with the id
//     in the message); known-id-disappear is a WARN (curated record is
//     preserved, no data is deleted).
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
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const SCRAPER_NAME = 'scrape-benchlm';
const SOURCE_URL = 'https://benchlm.ai/api/v1/rankings';
const DEFAULT_ALIAS_PATH = resolve(REPO_ROOT, 'data/benchlm-aliases.json');

/**
 * Clamp a BenchLM `score` to [0, 100]. Returns null for non-finite input
 * so the renderer shows "unavailable" instead of a zero bar.
 *
 * @param {number} n
 * @returns {number|null}
 */
function clampScore(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/**
 * Build the BenchLM block for a single curated model. Preserves all
 * fields returned by BenchLM (rank, evidence, etc.) while clamping the
 * score.
 *
 * @param {{score: number, verified: boolean, reliability?: number, categories?: Object, rank?: number, evidence?: string}} r
 * @returns {{score: number|null, verified: boolean, reliability: number, categories: Object, rank?: number, evidence?: string}}
 */
function benchlmBlock(r) {
  const block = {
    score: clampScore(r.score),
    verified: !!r.verified,
    reliability: typeof r.reliability === 'number' && Number.isFinite(r.reliability)
      ? Math.max(0, Math.min(1, r.reliability))
      : 0,
    categories: r.categories && typeof r.categories === 'object' ? r.categories : {},
  };
  if (r.rank != null) block.rank = r.rank;
  if (r.evidence) block.evidence = r.evidence;
  return block;
}

/**
 * Core scrape logic. Exported for tests; the CLI wrapper at the bottom
 * of this file calls `runScrape(parseArgs(process.argv))` and translates
 * the result into `exitWith`.
 *
 * @param {{dryRun: boolean, file: string, source: string|null, quiet: boolean, aliasPath?: string}} args
 * @param {{fetchText?: (url: string, opts?: any) => Promise<string>}} [deps]
 * @returns {Promise<{ok: boolean, scraper: string, phase?: string, error?: string, changes?: number, missing?: string[], dryRun?: boolean}>}
 */
export async function runScrape(args, deps) {
  const fetchTextFn = (deps && deps.fetchText) || fetchText;
  const url = args.source || SOURCE_URL;
  const aliasPath = args.aliasPath || DEFAULT_ALIAS_PATH;

  // 1. Fetch (no cooldown — the cron handler enforces its own)
  let text;
  try {
    text = await fetchTextFn(url, { cooldownMs: 0 });
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

  // 3. Validate top-level shape: { rankings: [...] }
  if (!payload || !Array.isArray(payload.rankings)) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: 'response missing top-level `rankings` array' };
  }

  // 4. Validate each entry has id + score + verified (score is a number)
  for (let i = 0; i < payload.rankings.length; i++) {
    const r = payload.rankings[i];
    if (!r || typeof r !== 'object') {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `rankings[${i}] is not an object` };
    }
    if (typeof r.id !== 'string' || r.id.length === 0) {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `rankings[${i}].id is missing or empty` };
    }
    if (typeof r.score !== 'number' || !Number.isFinite(r.score)) {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `rankings[${i}].score is missing or not a finite number (id=${r.id})` };
    }
    if (typeof r.verified !== 'boolean') {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `rankings[${i}].verified is missing or not a boolean (id=${r.id})` };
    }
  }

  // 5. Load alias table
  let aliases;
  try {
    aliases = loadAliases(aliasPath);
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'alias', error: err.message };
  }

  // 6. Map BenchLM ids → curated keys (fail-loud on miss)
  const mappedPresent = new Set();
  const benchlmByKey = new Map();
  for (const r of payload.rankings) {
    let curatedKey;
    try {
      curatedKey = mapBenchlmId(r.id, aliases);
    } catch (err) {
      return {
        scraper: SCRAPER_NAME,
        ok: false,
        phase: 'alias',
        error: err.message,
        code: err.code,
        benchlmId: err.benchlmId,
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

  // 11. Dry-run path
  if (args.dryRun) {
    summarizeDryRun(SCRAPER_NAME, changes);
    return { scraper: SCRAPER_NAME, ok: true, dryRun: true, changes: changes.length, missing };
  }

  // 12. No-op path
  if (changes.length === 0) {
    if (!args.quiet) console.log(`[${SCRAPER_NAME}] no changes — benchlm data already up to date`);
    return { scraper: SCRAPER_NAME, ok: true, changes: 0, missing };
  }

  // 13. Write atomically
  doc.models = updatedModels;
  try {
    writeModelsJson(args.file, doc, SCRAPER_NAME);
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'write', error: err.message };
  }

  if (!args.quiet) {
    console.log(`[${SCRAPER_NAME}] wrote ${changes.length} change(s) — missing: ${missing.length}`);
  }
  return { scraper: SCRAPER_NAME, ok: true, changes: changes.length, missing };
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
