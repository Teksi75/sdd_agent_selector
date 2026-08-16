// scripts/scrape-artificialanalysis.js
// Artificial Analysis scraper — fetches AA model pricing + optional
// evaluation/speed observations, validates the response shape, maps AA
// ids/slugs to curated keys via the alias table, and merges ONLY
// AA-owned fields into data/models.json using the atomic write helper.
//
// Source: https://artificialanalysis.ai/api/v2/data/llms/models (JSON;
// authenticated with `x-api-key` from env AA_API_KEY; falls back to
// --source file for fixtures). Attribution: https://artificialanalysis.ai/
//
// Conventions (matching the other scrapers):
//   - Atomic write via writeModelsJson (tmp + rename).
//   - Fail-loud on any unexpected shape; --dry-run reports the diff
//     without touching the file. --file redirects the target (tests).
//   - Alias-miss is FATAL (unknown AA id exits non-zero with the id in
//     the message); known-id-disappear is a WARN (curated record is
//     preserved, no data is deleted).
//   - AA owns ONLY the fields in FIELD_MAP plus `blended` and
//     `pricingSource`. Everything else (benchlm, arena, swePro, sweVer,
//     tier, notes, rate limits) is preserved untouched. Optional fields
//     are written only when the API returns a finite number; omissions
//     are documented in `notes`, never synthesized as 0/null.
//   - The 3:1 blended price is computed locally: (3*input + output)/4.
//     An upstream `blended` field is never trusted.
//   - On write, `_meta.schemaVersion` is explicitly set to 3 (the bump
//     is atomic with the first AA field write).
//
// CLI:
//   node scripts/scrape-artificialanalysis.js [--dry-run] [--file <path>]
//       [--source <url|file>] [--quiet] [--alias <path>]
//
// Environment:
//   AA_API_KEY — required for the live endpoint (GitHub Actions secret,
//   never hardcoded).

import {
  parseArgs,
  readModelsJson,
  writeModelsJson,
  fetchText,
  diffModels,
  summarizeDryRun,
  exitWith,
} from './_scraper-utils.mjs';
import { loadAaAliases, mapAaId, detectRename, detectMissing } from './_aa-safety.mjs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { existsSync, readFileSync as fsReadFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const SCRAPER_NAME = 'scrape-artificialanalysis';
const SOURCE_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models';
const ATTRIBUTION_URL = 'https://artificialanalysis.ai/';
const DEFAULT_ALIAS_PATH = resolve(REPO_ROOT, 'data/aa-aliases.json');
const SCHEMA_VERSION = 3;

/**
 * Response path (dot-separated) → curated field name. THE single
 * adjustment point for upstream field-name drift: when the live API
 * renames or moves a field, update its path here (spike 1.1 reconciles
 * the real names). `pricing.*` paths read the nested AA pricing object.
 */
const FIELD_MAP = {
  'pricing.input': 'input',
  'pricing.output': 'output',
  'pricing.cacheRead': 'cacheRead',
  'pricing.cacheWrite': 'cacheWrite',
  term: 'term',
  codingIndex: 'codingIndex',
  median_output_tokens_per_second: 'median_output_tokens_per_second',
  median_time_to_first_token_seconds: 'median_time_to_first_token_seconds',
};

/** Curated fields AA MUST return as finite numbers for every mapped entry. */
const REQUIRED_FIELDS = ['input', 'output'];

/**
 * Return true when `src` looks like a local filesystem path rather than
 * an HTTP(S) URL (mirrors scrape-benchlm).
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
 * Read a nested value from an object via a dot-separated path
 * (`"pricing.input"` → `obj.pricing.input`). Returns undefined when any
 * segment is missing.
 *
 * @param {Object} obj
 * @param {string} path
 * @returns {any}
 */
function getPath(obj, path) {
  let cur = obj;
  for (const segment of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[segment];
  }
  return cur;
}

/**
 * Validate that every REQUIRED_FIELDS value is present and finite for a
 * response entry. Returns an error message or null. Drift on required
 * pricing blocks the whole run — canonical data stays unchanged.
 *
 * @param {Object} entry
 * @param {string} identity - AA id, for the error message
 * @returns {string|null}
 */
function validateRequiredFields(entry, identity) {
  for (const curated of REQUIRED_FIELDS) {
    const path = Object.keys(FIELD_MAP).find((p) => FIELD_MAP[p] === curated);
    const v = getPath(entry, path);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return `model ${identity}: required field \`${curated}\` (path ${path}) is missing or not a finite number`;
    }
  }
  return null;
}

/**
 * Build the AA-owned patch for a mapped entry. Required fields are
 * copied verbatim (validated upstream by validateRequiredFields);
 * optional fields are written ONLY when the API returned a finite
 * number, otherwise they are collected into `absent` for documentation.
 * The 3:1 blended price is computed locally — an upstream `blended`
 * value is never read.
 *
 * @param {Object} entry
 * @returns {{patch: Object, absent: string[]}}
 */
function buildAaPatch(entry) {
  const patch = {};
  const absent = [];
  for (const [path, curated] of Object.entries(FIELD_MAP)) {
    const v = getPath(entry, path);
    if (REQUIRED_FIELDS.includes(curated)) {
      patch[curated] = v;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      patch[curated] = v;
    } else {
      absent.push(curated);
    }
  }
  patch.blended = (3 * patch.input + patch.output) / 4;
  patch.pricingSource = 'artificialanalysis';
  return { patch, absent };
}

/**
 * Document absent optional fields in the model `notes` (per schema v3:
 * absence is documented, never synthesized as 0/null). Idempotent per
 * day — the same omission note is never appended twice.
 *
 * @param {Object} model
 * @param {string[]} absentFields
 * @param {string} date - ISO date (YYYY-MM-DD)
 * @returns {Object}
 */
function documentAbsent(model, absentFields, date) {
  if (absentFields.length === 0) return model;
  const marker = `AA sync ${date}: omitted`;
  if (typeof model.notes === 'string' && model.notes.includes(marker)) return model;
  const fragment = `${marker} ${absentFields.join(', ')} (not returned by API; never synthesized)`;
  const notes = typeof model.notes === 'string' ? model.notes : '';
  return { ...model, notes: notes ? `${notes} ${fragment}` : fragment };
}

/**
 * Append the AA attribution entry to the model `sources[]` (deduped by
 * url + date + scraper so repeated runs preserve history without growth).
 *
 * @param {Object} model
 * @param {string} date - ISO date (YYYY-MM-DD)
 * @returns {Object}
 */
function appendAttribution(model, date) {
  const source = { url: ATTRIBUTION_URL, date, scraper: SCRAPER_NAME };
  const sources = Array.isArray(model.sources)
    ? model.sources.filter(
        (s) => !(s && s.url === source.url && s.date === source.date && s.scraper === source.scraper),
      )
    : [];
  return { ...model, sources: [...sources, source] };
}

/**
 * Core scrape logic. Exported for tests; the CLI wrapper at the bottom
 * of this file calls `runScrape(parseArgs(process.argv))` and translates
 * the result into `exitWith`.
 *
 * @param {{dryRun: boolean, file: string, source: string|null, quiet: boolean, aliasPath?: string}} args
 * @param {{fetchText?: (url: string, opts?: any) => Promise<string>}} [deps]
 * @returns {Promise<{ok: boolean, scraper: string, phase?: string, error?: string, code?: string, changes?: number, missing?: string[], dryRun?: boolean}>}
 */
export async function runScrape(args, deps) {
  const fetchTextFn = (deps && deps.fetchText) || fetchText;
  const url = args.source || SOURCE_URL;
  const aliasPath = args.aliasPath || DEFAULT_ALIAS_PATH;
  const apiKey = process.env.AA_API_KEY;

  // 1. Fetch. When --source points at a local fixture path, read it
  //    directly so the CLI can be exercised without a live endpoint.
  let text;
  try {
    if (isLocalPath(url)) {
      const localPath = isAbsolute(url) ? url : resolve(process.cwd(), url);
      if (!existsSync(localPath)) {
        return { scraper: SCRAPER_NAME, ok: false, phase: 'fetch', error: `local fixture not found: ${localPath}` };
      }
      text = fsReadFileSync(localPath, 'utf-8');
    } else {
      const headers = apiKey ? { 'x-api-key': apiKey } : undefined;
      text = await fetchTextFn(url, { cooldownMs: 0, headers });
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

  // 4. Validate each entry has a non-empty `id`.
  for (let i = 0; i < payload.models.length; i++) {
    const r = payload.models[i];
    if (!r || typeof r !== 'object') {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `models[${i}] is not an object` };
    }
    if (typeof r.id !== 'string' || r.id.length === 0) {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: `models[${i}].id is missing or empty` };
    }
  }

  // 5. Load alias table
  let aliases;
  try {
    aliases = loadAaAliases(aliasPath);
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'alias', error: err.message };
  }

  // 6. Detect renames, map AA ids → curated keys, and run the required
  //    pricing drift guard (fail-loud on miss, rename, or drift).
  const mappedPresent = new Set();
  const aaByKey = new Map();
  for (const r of payload.models) {
    try {
      detectRename(r.id, r.slug, aliases);
    } catch (err) {
      return {
        scraper: SCRAPER_NAME,
        ok: false,
        phase: 'alias',
        error: err.message,
        code: err.code,
        oldId: err.oldId,
        newId: err.newId,
      };
    }
    let curatedKey;
    try {
      curatedKey = mapAaId(r.id, aliases);
    } catch (err) {
      return {
        scraper: SCRAPER_NAME,
        ok: false,
        phase: 'alias',
        error: err.message,
        code: err.code,
        aaId: err.aaId,
      };
    }
    const requiredErr = validateRequiredFields(r, r.id);
    if (requiredErr) {
      return { scraper: SCRAPER_NAME, ok: false, phase: 'validate', error: requiredErr, code: 'AA_REQUIRED_FIELD_MISSING' };
    }
    mappedPresent.add(curatedKey);
    aaByKey.set(curatedKey, r);
  }

  // 7. Read existing data/models.json (or the --file override)
  let doc;
  try {
    doc = readModelsJson(args.file);
  } catch (err) {
    return { scraper: SCRAPER_NAME, ok: false, phase: 'read', error: err.message };
  }

  // 8. Detect missing known ids (curated ids AA did NOT mention).
  const missing = detectMissing(Object.keys(doc.models), mappedPresent);

  // 9. Build the updated models object — field-scoped AA-only merge.
  const today = new Date().toISOString().slice(0, 10);
  const before = JSON.parse(JSON.stringify(doc.models));
  const updatedModels = { ...doc.models };
  for (const [curatedKey, entry] of aaByKey) {
    const existing = updatedModels[curatedKey];
    if (!existing) {
      if (!args.quiet) console.log(`[${SCRAPER_NAME}] note: curated key "${curatedKey}" is not tracked — skipping`);
      continue;
    }
    const { patch, absent } = buildAaPatch(entry);
    let merged = { ...existing, ...patch };
    merged = appendAttribution(merged, today);
    merged = documentAbsent(merged, absent, today);
    updatedModels[curatedKey] = merged;
  }

  // 10. Log missing-known warnings
  if (!args.quiet) {
    for (const id of missing) {
      console.log(`[${SCRAPER_NAME}] warn: curated id "${id}" was not returned by Artificial Analysis — preserving record`);
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
    if (!args.quiet) console.log(`[${SCRAPER_NAME}] no changes — artificial analysis data already up to date`);
    return { scraper: SCRAPER_NAME, ok: true, changes: 0, missing };
  }

  // 13. Bump schema atomically with the first AA field write, then write.
  doc.models = updatedModels;
  doc._meta.schemaVersion = SCHEMA_VERSION;
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
  // parseArgs does not know about --alias; read it here (mirrors scrape-benchlm).
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
