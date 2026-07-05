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
// Coverage (13 models per OpenCode Go page):
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

  // Walk through every known display name and try to apply updates.
  for (const [displayName, key] of Object.entries(NAME_TO_KEY)) {
    const price = priceByName[displayName];
    const quota = quotaByName[displayName];
    if (!price && !quota) {
      unmatched.push(displayName);
      continue;
    }
    if (!updatedModels[key]) {
      // The model isn't in our dataset yet — skip silently for "large"
      // context-window variants (we don't track those separately).
      if (key.endsWith('.large')) continue;
      unmatched.push(`${displayName} → no model key ${key}`);
      continue;
    }
    const patch = { ...(price || {}), ...(quota || {}) };
    updatedModels[key] = applyPatch(updatedModels[key], patch);
    updated.push(key);
  }

  const changes = diffModels(before, updatedModels);

  if (args.dryRun) {
    summarizeDryRun(SCRAPER_NAME, changes);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      dryRun: true,
      updated: updated.length,
      unmatched,
      changes: changes.length,
    });
  }

  if (changes.length === 0) {
    console.log(`[${SCRAPER_NAME}] no changes detected — data already up to date`);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      updated: 0,
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

  console.log(`[${SCRAPER_NAME}] wrote ${changes.length} field update(s) across ${updated.length} model(s)`);
  return exitWith(0, {
    scraper: SCRAPER_NAME,
    ok: true,
    updated: updated.length,
    changes: changes.length,
    unmatched,
  });
}

main();