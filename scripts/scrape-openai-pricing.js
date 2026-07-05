#!/usr/bin/env node
// scripts/scrape-openai-pricing.js
// Phase 3 scraper — OpenAI platform pricing page.
//
// Source: https://platform.openai.com/docs/pricing
//
// The page serializes model pricing data as Astro `[type, value]` pairs
// inside script tags. We extract the flagship-models section and pull
// out 6 models (gpt-5.5, gpt-5.5-pro, gpt-5.4, gpt-5.4-mini, gpt-5.4-nano,
// gpt-5.4-pro) with their Standard pricing for the SHORT context window.
//
// Updates each model in data/models.json with fields:
//   - input, cacheRead, output (Standard pricing, Short context)
//
// Cooldown: only updates when the model does not exist OR when
// >5 days have passed since lastSynced (avoids churn from intermediate
// edits OpenAI makes to the page).
//
// Mapping (model name on page → models.json key):
//   gpt-5.5 (short) → gpt55        gpt-5.4-mini      → gpt54Mini
//   gpt-5.5-pro     → gpt55Pro     gpt-5.4-nano      → gpt54Nano
//   gpt-5.4 (short) → gpt54        gpt-5.4-pro       → gpt54Pro

import {
  parseArgs,
  readModelsJson,
  writeModelsJson,
  fetchText,
  diffModels,
  summarizeDryRun,
  exitWith,
} from './_scraper-utils.mjs';

const SOURCE_URL = 'https://platform.openai.com/docs/pricing';
const SCRAPER_NAME = 'scrape-openai-pricing';
const STALENESS_COOLDOWN_DAYS = 5;

/**
 * Map from the OpenAI display name (with optional "(<272K context
 * length)" suffix) to the models.json key.
 *
 * We keep the `(short)` parenthetical-less rows so we get the Standard
 * pricing tier. Rows with "long context" suffixes are ignored.
 */
const NAME_PATTERNS = [
  { pattern: /^gpt-5\.5\b/, key: 'gpt55' },         // gpt-5.5 or gpt-5.5 (<272K...)
  { pattern: /^gpt-5\.5-pro\b/, key: 'gpt55Pro' },
  { pattern: /^gpt-5\.4\b/, key: 'gpt54' },
  { pattern: /^gpt-5\.4-mini\b/, key: 'gpt54Mini' },
  { pattern: /^gpt-5\.4-nano\b/, key: 'gpt54Nano' },
  { pattern: /^gpt-5\.4-pro\b/, key: 'gpt54Pro' },
];

/**
 * Parse OpenAI's Astro `[type, value]` price serialization. We find
 * every pricing row that starts with a quoted model name and extract
 * the four numeric slots that follow (input, cached input, output,
 * ...). The cached input slot is index 2; output is index 3.
 *
 * Each cell is one of:
 *   [0, "model name"]   → string cell
 *   [0, 5]              → number cell
 *   [0, ""]             → empty (no cached price)
 *   [0, null]           → null (e.g. legacy models without cache)
 *   [0, "-"]            → dash
 *
 * We use a tiny bracket-matching parser to handle nested arrays.
 *
 * @param {string} html
 * @returns {Array<{name: string, input: number|null, cacheRead: number|null, output: number|null}>}
 */
function parsePricingRows(html) {
  const rows = [];
  // Find every quoted model name (the page embeds them as `"gpt-5.x ..."`).
  const nameRe = /"((?:gpt|o\d|chatgpt)[a-z0-9.\\-]*(?:[ ][^"]{0,60})?)"/g;
  let m;
  while ((m = nameRe.exec(html)) !== null) {
    const name = m[1].trim();
    // Must contain a model family identifier.
    if (!/^(gpt|o\d|chatgpt)/.test(name)) continue;
    // Skip non-pricing contexts (e.g. model mentions in article excerpts).
    // The pricing rows are always preceded by `[1,[[0,"...name...` — look
    // backwards for the closest `[0,"...name...` whose preceding char is
    // `[1,[[` (i.e., inside a rows table).
    const ctx = html.slice(Math.max(0, m.index - 50), m.index + 800);
    if (!/\[1,\[\[\d,\[\[0,"/.test(ctx)) continue;

    // Parse the 4 numeric cells that follow the name. Astro format:
    //   [0,"name"],[0,5],[0,0.5],[0,30]
    // We walk forward through brackets to collect them.
    const startIdx = m.index + m[0].length;
    const cells = parseAstroCells(html, startIdx, 4);
    if (cells.length < 3) continue;
    const input = numericCell(cells[0]);
    const cacheRead = numericCell(cells[1]);
    const output = numericCell(cells[2]);
    rows.push({ name, input, cacheRead, output });
  }
  return rows;
}

/**
 * Parse N consecutive Astro cells starting at `startIdx`. Each cell is
 * one of: `[0,"string"]`, `[0,number]`, `[0,""]`, `[0,null]`.
 *
 * @param {string} html
 * @param {number} startIdx
 * @param {number} count
 * @returns {string[]} raw cell source fragments
 */
function parseAstroCells(html, startIdx, count) {
  const cells = [];
  let i = startIdx;
  while (cells.length < count && i < html.length) {
    // Skip whitespace and commas.
    while (i < html.length && /[\s,]/.test(html[i])) i++;
    if (i >= html.length || html[i] !== '[') break;
    // Walk brackets.
    let depth = 0;
    let cellStart = i;
    while (i < html.length) {
      if (html[i] === '[') depth++;
      else if (html[i] === ']') {
        depth--;
        if (depth === 0) { i++; break; }
      }
      i++;
    }
    cells.push(html.slice(cellStart, i));
    // Stop if we hit a row terminator `],`.
    if (html[i] === ',') continue;
  }
  return cells;
}

/** Coerce an Astro cell to a number (null if empty / dash). */
function numericCell(cell) {
  if (!cell) return null;
  // Strip outer [ ].
  const inner = cell.replace(/^\[|\]$/g, '').trim();
  // Format: [0, value]
  const m = /^\[\d+,(.*)\]$/.exec(inner);
  if (!m) return null;
  const v = m[1].trim();
  if (v === '' || v === '""' || v === 'null' || v === '"-"') return null;
  // Remove quotes if it's a string.
  const cleaned = v.replace(/^"|"$/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Filter the pricing rows down to the 6 flagship models we track, and
 * prefer the "Short context" / "<272K" variants when both exist.
 *
 * @param {Array<{name: string, ...}>} rows
 * @returns {Map<string, {input: number|null, cacheRead: number|null, output: number|null}>}
 */
function filterFlagships(rows) {
  const out = new Map();
  for (const r of rows) {
    // Skip "long context" or non-flagship rows.
    if (/longer than|over|>|272K/.test(r.name)) continue;
    for (const { pattern, key } of NAME_PATTERNS) {
      if (pattern.test(r.name)) {
        // Keep the first match (short-context row, which appears before long-context in the page).
        if (!out.has(key)) out.set(key, r);
        break;
      }
    }
  }
  return out;
}

/**
 * Check whether the cooldown applies — return true if the model is
 * either missing OR lastSynced is older than 5 days.
 */
function shouldUpdate(model, today) {
  if (!model) return true;
  // Models without lastSynced are first-time inserts — always update.
  if (!model.lastSynced) return true;
  const last = new Date(`${model.lastSynced}T00:00:00Z`).getTime();
  if (Number.isNaN(last)) return true;
  const diffDays = (today.getTime() - last) / (1000 * 60 * 60 * 24);
  return diffDays > STALENESS_COOLDOWN_DAYS;
}

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

  const rows = parsePricingRows(html);
  if (rows.length === 0) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'parse',
      error: 'No pricing rows found. The page serialization may have changed.',
    });
  }

  const flagships = filterFlagships(rows);
  if (flagships.size === 0) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'filter',
      error: `Found ${rows.length} pricing row(s) but none matched the flagship patterns. Model names may have changed.`,
      sample: rows.slice(0, 5).map((r) => r.name),
    });
  }

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

  const today = new Date();
  const before = JSON.parse(JSON.stringify(doc.models));
  const updatedModels = { ...doc.models };
  const updated = [];
  const skipped = [];

  for (const [key, row] of flagships) {
    const existing = updatedModels[key];
    if (!shouldUpdate(existing, today)) {
      skipped.push(key);
      continue;
    }
    const tier = 'high';
    const patch = {
      name: row.name.split(' (')[0], // strip "(<272K context length)" suffix
      tier,
      input: row.input,
      output: row.output,
      ...(row.cacheRead != null ? { cacheRead: row.cacheRead } : {}),
    };
    if (existing) {
      updatedModels[key] = { ...existing, ...patch };
    } else {
      updatedModels[key] = { ...patch, sources: [{ url, date: today.toISOString().slice(0, 10) }] };
    }
    updated.push(key);
  }

  const changes = diffModels(before, updatedModels);

  if (args.dryRun) {
    summarizeDryRun(SCRAPER_NAME, changes);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      dryRun: true,
      rows: rows.length,
      flagships: flagships.size,
      updated: updated.length,
      skipped,
      changes: changes.length,
    });
  }

  if (changes.length === 0) {
    console.log(`[${SCRAPER_NAME}] no changes — all flagship models are within cooldown`);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      updated: 0,
      skipped,
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

  console.log(`[${SCRAPER_NAME}] wrote ${changes.length} change(s) across ${updated.length} model(s)`);
  return exitWith(0, {
    scraper: SCRAPER_NAME,
    ok: true,
    updated: updated.length,
    skipped,
    changes: changes.length,
  });
}

main();