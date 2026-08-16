#!/usr/bin/env node
// scripts/scrape-opencode-prices.js
// Phase 3 scraper — OpenCode Go pricing + quota tables.
//
// Source: https://opencode.ai/docs/es/go/
// Parses two <table> blocks:
//   1. Quota table   : Model | peticiones/5h | peticiones/semana | peticiones/mes
//   2. Pricing table : Modelo | Entrada | Salida | Lectura en caché | Escritura en caché
//
// Updates each model in data/models.json with fields:
//   - input, output, cacheRead, cacheWrite (when present)
//   - requestsPer5h, requestsPerWeek, requestsPerMonth
//
// Coverage (curated NAME_TO_KEY mapping, 16 entries / 14 base models):
//   GLM-5.2, GLM-5.1, Kimi K2.7 Code, Kimi K2.6, MiMo V2.5, MiMo V2.5 Pro,
//   MiniMax M3, MiniMax M2.7, MiniMax M2.5, Qwen3.7 Max, Qwen3.7 Plus,
//   Qwen3.6 Plus, DeepSeek V4 Pro, DeepSeek V4 Flash.
//
// Mapping (HTML label → models.json key):
//   "GLM-5.2"      → glm52        "MiMo V2.5 Pro" → mimo25pro
//   "GLM-5.1"      → glm51        "MiniMax M3"    → minimaxm3
//   "Kimi K2.7 Code" → kimik27c    "MiniMax M2.7"  → minimaxm27
//   "Kimi K2.6"    → kimik26      "MiniMax M2.5"  → minimaxm25
//   "MiMo V2.5"    → mimo25       "Qwen3.7 Max"   → qwen37max
//   "Qwen3.7 Plus" → qwen37plus   "Qwen3.6 Plus"  → qwen36plus
//   "DeepSeek V4 Pro" → deepseekv4p   "DeepSeek V4 Flash" → deepseekv4f
//
// Qwen3.7 Plus and Qwen3.6 Plus have two rows each (≤ 256K and > 256K
// pricing). We use the ≤ 256K row as the canonical entry (the standard
// pricing tier), and ignore the > 256K row.
//
// Auto-discovery (V5.3 — see PR description): when a model appears in
// the upstream page but is not in NAME_TO_KEY and does not fuzzy-match
// an existing entry in data/models.json, the scraper auto-stubs a new
// entry with whatever data the page provides (name + pricing + rate
// limits). The stub gets a `benchlm: { score: null, … }` placeholder
// (per the data-integrity contract) and an `isNew: true` flag so the
// UI surfaces it as a freshly-discovered model. This is the fix for
// the "new opencode Go models don't appear until you add them
// manually" coverage hole.

import {
  parseArgs,
  readModelsJson,
  writeModelsJson,
  fetchText,
  parsePrice,
  diffModels,
  summarizeDryRun,
  exitWith,
} from './_scraper-utils.mjs';
import { guardVendorPricePatch } from './_pricing-safety.mjs';

const SOURCE_URL = 'https://opencode.ai/docs/es/go/';
const SCRAPER_NAME = 'scrape-opencode-prices';

/**
 * Map OpenCode's display name to the model key used in data/models.json.
 * Returns null for names that don't match (so we don't fail the whole
 * run if OpenCode adds a model we haven't cataloged yet).
 */
const NAME_TO_KEY = {
  'GLM-5.2': 'glm52',
  'GLM-5.1': 'glm51',
  'Kimi K2.7 Code': 'kimik27c',
  'Kimi K2.6': 'kimik26',
  'MiMo V2.5': 'mimo25',
  'MiMo V2.5 Pro': 'mimo25pro',
  'MiniMax M3': 'minimaxm3',
  'MiniMax M2.7': 'minimaxm27',
  'MiniMax M2.5': 'minimaxm25',
  'Qwen3.7 Max': 'qwen37max',
  'Qwen3.7 Plus (≤ 256K tokens)': 'qwen37plus',
  'Qwen3.7 Plus (> 256K tokens)': 'qwen37plus.large',
  'Qwen3.6 Plus (≤ 256K tokens)': 'qwen36plus',
  'Qwen3.6 Plus (> 256K tokens)': 'qwen36plus.large',
  'DeepSeek V4 Pro': 'deepseekv4p',
  'DeepSeek V4 Flash': 'deepseekv4f',
  'GPT 5.6 Luna': 'gpt56luna',
  'Hy3': 'opencodeHy3',
  'Grok 4.5': 'grok45',
  'Qwen3.8 Max': 'qwen38max',
};

/**
 * Parse a <table> block from the HTML and return rows as
 *   [{ header: [string, ...], data: [[string, ...], ...] }]
 *
 * We use a tiny purpose-built parser (no deps). It is strict about
 * well-formed `<table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>`
 * because that's what OpenCode emits.
 *
 * @param {string} html
 * @returns {Array<{header: string[], data: string[][]}>}
 */
function parseAllTables(html) {
  const tables = [];
  // Match each <table>...</table> block (non-nested, no nesting in OpenCode).
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/g;
  let m;
  while ((m = tableRe.exec(html)) !== null) {
    const body = m[1];
    // Header cells.
    const header = [];
    const thRe = /<th[^>]*>([\s\S]*?)<\/th>/g;
    let th;
    while ((th = thRe.exec(body)) !== null) {
      header.push(stripTags(th[1]).trim());
    }
    // Body rows.
    const data = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let tr;
    while ((tr = trRe.exec(body)) !== null) {
      const row = tr[1];
      // Skip rows inside <thead>.
      if (/<th/i.test(row)) continue;
      const cells = [];
      const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let td;
      while ((td = tdRe.exec(row)) !== null) {
        cells.push(stripTags(td[1]).trim());
      }
      if (cells.length > 0) data.push(cells);
    }
    if (header.length > 0 || data.length > 0) {
      tables.push({ header, data });
    }
  }
  return tables;
}

/** Strip HTML tags from a fragment and decode common entities. */
function stripTags(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Identify a table by its header signature. Returns a stable key:
 *   'quota' | 'pricing' | 'unknown'
 *
 * @param {string[]} header
 * @returns {string}
 */
function classifyTable(header) {
  const h = header.join('|').toLowerCase();
  if (h.includes('peticiones por') && h.includes('5 horas')) return 'quota';
  if (h.includes('entrada') && h.includes('salida')) return 'pricing';
  return 'unknown';
}

/**
 * Apply a single update to a model record. Only sets fields that are
 * not NaN; preserves existing fields the scraper doesn't manage.
 *
 * @param {Object} model
 * @param {Object} patch
 * @returns {Object} the updated model (new object)
 */
function applyPatch(model, patch) {
  const out = { ...model };
  for (const [k, v] of Object.entries(patch)) {
    if (Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * Normalize a model display name for fuzzy matching. Lowercases and
 * strips spaces / dots / hyphens / parens. "Grok 4.5" → "grok45",
 * "Qwen3.7 Plus" → "qwen37plus", "MiMo V2.5 Pro" → "mimov25pro".
 *
 * @param {string} s
 * @returns {string}
 */
function normName(s) {
  return String(s || '').toLowerCase().replace(/[\s.\-()]+/g, '');
}

/**
 * Today's date in YYYY-MM-DD (UTC). Used as the `sources[].date` for
 * auto-stubbed models and the audit trail entry.
 *
 * @returns {string}
 */
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build a minimal stub entry for a model the scraper discovered on
 * the page but doesn't have an existing record for. The stub carries
 * just enough data to satisfy the data-integrity contract (name,
 * benchlm placeholder, tier, lifecycle, pricing where present,
 * rate-limits where present, an `isNew: true` flag, and a sources
 * entry pointing at the opencode Go page). All other fields
 * (arena / swePro / sweVer / term / notes-detail / curated tier)
 * are intentionally left for human curation on a subsequent pass.
 *
 * @param {string} displayName  - the name as it appears on the page
 * @param {Object|null} price   - parsed price row (input/output/cacheRead/cacheWrite)
 * @param {Object|null} quota   - parsed quota row (requestsPer5h/Week/Month)
 * @returns {Object} a fresh model record
 */
function makeStub(displayName, price, quota) {
  const today = todayIso();
  return {
    name: displayName,
    benchlm: { score: null, verified: false, reliability: 0, categories: {} },
    tier: 'high',
    lifecycle: 'active',
    isNew: true,
    ...(Number.isFinite(price?.input) ? { input: price.input } : {}),
    ...(Number.isFinite(price?.output) ? { output: price.output } : {}),
    ...(Number.isFinite(price?.cacheRead) ? { cacheRead: price.cacheRead } : {}),
    ...(Number.isFinite(price?.cacheWrite) ? { cacheWrite: price.cacheWrite } : {}),
    ...(Number.isFinite(quota?.requestsPer5h) ? { requestsPer5h: quota.requestsPer5h } : {}),
    ...(Number.isFinite(quota?.requestsPerWeek) ? { requestsPerWeek: quota.requestsPerWeek } : {}),
    ...(Number.isFinite(quota?.requestsPerMonth) ? { requestsPerMonth: quota.requestsPerMonth } : {}),
    notes: `Auto-stubbed by ${SCRAPER_NAME} on ${today}. Pricing + rate limits from opencode Go. BenchLM/Arena/SWE/Terminal-Bench: pending curation.`,
    sources: [
      {
        url: 'https://opencode.ai/docs/es/go/#usage-limits',
        date: today,
        scraper: SCRAPER_NAME,
      },
    ],
  };
}

/**
 * Main entry — fetch + parse + update + write (or dry-run).
 */
async function main() {
  const args = parseArgs(process.argv);
  const url = args.source || SOURCE_URL;

  let html;
  try {
    html = await fetchText(url);
  } catch (err) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'fetch',
      error: err.message,
    });
  }

  const tables = parseAllTables(html);
  if (tables.length < 2) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'parse',
      error: `Expected at least 2 tables (quota + pricing), found ${tables.length}. The upstream HTML structure may have changed.`,
      tablesFound: tables.length,
    });
  }

  // Build a map: classified table by name.
  const classified = {};
  for (const t of tables) {
    const k = classifyTable(t.header);
    if (k === 'unknown') continue;
    if (!classified[k]) classified[k] = t;
  }
  if (!classified.quota || !classified.pricing) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'parse',
      error: `Could not find both quota and pricing tables. quota=${!!classified.quota} pricing=${!!classified.pricing}`,
      headers: tables.map((t) => t.header),
    });
  }

  // Build a price map keyed by display name.
  const priceByName = {};
  for (const row of classified.pricing.data) {
    if (row.length < 3) continue;
    const [name, input, output, cacheRead, cacheWrite] = row;
    priceByName[name] = {
      input: parsePrice(input),
      output: parsePrice(output),
      cacheRead: parsePrice(cacheRead),
      cacheWrite: parsePrice(cacheWrite),
    };
  }

  // Build a quota map keyed by display name.
  const quotaByName = {};
  for (const row of classified.quota.data) {
    if (row.length < 4) continue;
    const [name, p5h, pWeek, pMonth] = row;
    quotaByName[name] = {
      requestsPer5h: parsePrice(p5h),
      requestsPerWeek: parsePrice(pWeek),
      requestsPerMonth: parsePrice(pMonth),
    };
  }

  // Read existing data and compute the patch.
  let doc;
  try {
    doc = readModelsJson(args.file);
  } catch (err) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'read',
      error: err.message,
    });
  }

  const before = JSON.parse(JSON.stringify(doc.models));
  const updatedModels = { ...doc.models };
  const unmatched = [];
  const updated = [];
  const discovered = [];

  // Patch helper: for EXISTING models we only apply the opencode-specific
  // rate-limit fields. The base input/output/cacheRead/cacheWrite prices
  // are managed by other scrapers (anthropic-pricing, openai-pricing,
  // benchlm) and/or curated manually — we deliberately do NOT overwrite
  // them here. The opencode Go subscription bundles a different rate
  // card and applying it would corrupt the public-API pricing in the
  // catalog. Cache pricing for EXISTING models is also left to the
  // upstream provider scrapers or human curation.
  const applyQuotaPatch = (model, quota) => {
    if (!quota) return model;
    return applyPatch(model, {
      requestsPer5h: quota.requestsPer5h,
      requestsPerWeek: quota.requestsPerWeek,
      requestsPerMonth: quota.requestsPerMonth,
    });
  };

  // Pass 1 — NAME_TO_KEY (preserves curated mappings + the .large
  // context-window variants that the auto-discovery pass would
  // otherwise collapse into the base name).
  for (const [displayName, key] of Object.entries(NAME_TO_KEY)) {
    const price = priceByName[displayName];
    const quota = quotaByName[displayName];
    if (!price && !quota) {
      unmatched.push(displayName);
      continue;
    }
    if (key.endsWith('.large')) {
      // V4-specific large-context-window variants. Apply the patch to
      // the existing record if we have one; otherwise skip — we don't
      // auto-stub a `.large` sibling, that's a curation decision.
      if (updatedModels[key]) {
        updatedModels[key] = applyQuotaPatch(updatedModels[key], quota);
        updated.push(key);
      }
      continue;
    }
    if (!updatedModels[key]) {
      // The mapping points at a key that no longer exists in
      // data/models.json. Don't auto-stub here — that's what pass 2
      // does — just report and move on.
      unmatched.push(`${displayName} → no model key ${key}`);
      continue;
    }
    updatedModels[key] = applyQuotaPatch(updatedModels[key], quota);
    updated.push(key);
  }

  // Pass 2 — auto-discover new models on the page. The page may list
  // models we don't have in NAME_TO_KEY and don't have in data yet;
  // those would silently be lost under the old loop. Here we:
  //   1. skip anything NAME_TO_KEY already handled
  //   2. skip "(≤ NK tokens)" / "(> NK tokens)" variants (they're
  //      duplicate rows of a base name we may have already processed)
  //   3. fuzzy-match against existing model.name fields
  //   4. if no match, auto-stub a fresh entry with a minimal record
  //      so the new model appears in the catalog on the next build.
  const normByModelName = {};
  for (const [key, m] of Object.entries(updatedModels)) {
    if (m.name) normByModelName[normName(m.name)] = key;
  }
  const allPageNames = new Set([
    ...Object.keys(priceByName),
    ...Object.keys(quotaByName),
  ]);
  for (const rawName of allPageNames) {
    if (NAME_TO_KEY[rawName]) continue; // pass 1 handled it
    // Match ASCII <=/> AND Unicode ≤/≥ variants ("Qwen3.7 Plus (> 256K
    // tokens)", "GPT 5.6 Luna (≤ 272K tokens)").
    if (/\([<>≤≥]=?\s*\d+K tokens\)/i.test(rawName)) continue; // size variant
    const norm = normName(rawName);
    if (!norm) continue;
    let key = normByModelName[norm];
    let isFresh = false;
    if (!key) {
      if (updatedModels[norm]) continue; // collision guard (shouldn't happen)
      key = norm;
      // For brand-new models, the opencode page is the ONLY source we
      // have, so the stub carries the full price + quota data. The
      // user can later curate the input/output against the public
      // API pricing pages.
      // AA pricing precedence (schema v3): the vendor guard must never
      // write input/output/cacheRead/cacheWrite for an AA-owned model.
      // A fresh stub has NO existing record, so aaOwnsPricing() is
      // always false here — a structural no-op that stays safe if this
      // flow ever changes. Existing models only receive rate-limit
      // fields (never pricing) via applyQuotaPatch.
      const guardedPrice = guardVendorPricePatch(updatedModels[key], priceByName[rawName]);
      updatedModels[key] = makeStub(rawName, guardedPrice, quotaByName[rawName]);
      normByModelName[norm] = key;
      isFresh = true;
      discovered.push({ displayName: rawName, key });
      if (!args.quiet) {
        console.log(`[${SCRAPER_NAME}] AUTO-STUB new model: "${rawName}" → key=${key}`);
      }
    } else {
      // Existing model matched by fuzzy name. Same restricted patch
      // policy as pass 1: only rate limits, never pricing fields.
      updatedModels[key] = applyQuotaPatch(updatedModels[key], quotaByName[rawName]);
    }
    if (!updated.includes(key)) updated.push(key);
  }

  const changes = diffModels(before, updatedModels);

  if (args.dryRun) {
    summarizeDryRun(SCRAPER_NAME, changes);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      dryRun: true,
      updated: updated.length,
      discovered,
      unmatched,
      changes: changes.length,
    });
  }

  if (changes.length === 0 && discovered.length === 0) {
    console.log(`[${SCRAPER_NAME}] no changes detected — data already up to date`);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      updated: 0,
      discovered,
      unmatched,
      changes: 0,
    });
  }

  doc.models = updatedModels;
  try {
    writeModelsJson(args.file, doc, SCRAPER_NAME);
  } catch (err) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'write',
      error: err.message,
    });
  }

  if (discovered.length > 0) {
    console.log(
      `[${SCRAPER_NAME}] wrote ${changes.length} field update(s) across ${updated.length} model(s); ` +
      `auto-stubbed ${discovered.length} new model(s): ` +
      discovered.map((d) => `${d.displayName} (${d.key})`).join(', ')
    );
  } else {
    console.log(`[${SCRAPER_NAME}] wrote ${changes.length} field update(s) across ${updated.length} model(s)`);
  }
  return exitWith(0, {
    scraper: SCRAPER_NAME,
    ok: true,
    updated: updated.length,
    discovered,
    changes: changes.length,
    unmatched,
  });
}

main();