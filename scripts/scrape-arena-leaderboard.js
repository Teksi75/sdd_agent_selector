#!/usr/bin/env node
// scripts/scrape-arena-leaderboard.js
// Phase 3 scraper — LMSYS Chatbot Arena leaderboard.
//
// Source: https://lmarena.ai/leaderboard
//
// The page server-renders a <table> with model name + per-category RANK
// positions (1, 2, 3...). Absolute ELO scores are NOT in the rendered
// HTML — they load via the SPA's hydration data and the ELO change %
// ("13.34% ±1.55%") appears as a separate chip below the rank cell.
//
// What we DO extract per model (where present in the rendered HTML):
//   - model name (publicName slug like "claude-fable-5")
//   - rank position in the "Text" / "Overall" column (a single-digit
//     rank integer — not an ELO score)
//
// Matching strategy (lowercase + dash-stripped):
//   "claude-fable-5"        → "claudefable5"     (custom: not in data yet)
//   "claude-opus-4-8-thinking" → "claudeopus48thinking"  → claudeOpus48Thinking
//   "gpt-5.5-high"          → "gpt55high"
//   "glm-5.2"               → "glm52"
//   "kimi-k2.6"             → "kimik26"
//
// Per design.md the spec calls for an `arena` field (ELO score). Since
// the HTML only exposes rank positions, this scraper:
//   - logs the rank position (the single-digit number in the first <td>
//     after the model name) as a debug aid
//   - does NOT modify data/models.json with ELO scores
//   - exits 0 with a "no-op" status when the page structure has no ELO
//
// The data refresh for `arena` ELO scores will be revisited in a future
// PR when LMArena exposes a stable JSON API. For V4 initial release,
// the `arena` field stays at its last-known value (manual or auto-set).

import {
  parseArgs,
  readModelsJson,
  writeModelsJson,
  fetchText,
  diffModels,
  summarizeDryRun,
  exitWith,
} from './_scraper-utils.mjs';

const SOURCE_URL = 'https://lmarena.ai/leaderboard';
const SCRAPER_NAME = 'scrape-arena-leaderboard';

/**
 * Build the lowercase + dash-stripped key for a model name from
 * LMArena's publicName. We accept two model.key variants:
 *   "claudeOpus48Thinking" — camelCase (used in our models.json)
 *   "claudeOpus48"         — short form (no thinking suffix)
 *
 * The function returns a Set of candidate keys to try.
 *
 * @param {string} arenaName
 * @returns {string[]}
 */
function candidateKeys(arenaName) {
  const dashStripped = arenaName.toLowerCase().replace(/-/g, '');
  // Drop common suffixes that don't match our model keys.
  const stripped = dashStripped
    .replace(/-thinking$/i, '')
    .replace(/thinking$/, '');
  // Try both "with-thinking" and "without-thinking" variants.
  return [dashStripped, dashStripped + 'thinking', stripped, stripped + 'thinking'];
}

/**
 * Parse the rendered <table> on the page and return rows as
 *   [{ name, ranks: number[] }]
 *
 * Each row has the structure:
 *   <tr ...>
 *     <td>{name (in a span with title=...)}</td>
 *     <td>1</td>  <td>3</td> ...  (one <td> per category)
 *   </tr>
 *
 * @param {string} html
 * @returns {Array<{name: string, ranks: number[]}>}
 */
function parseLeaderboardTable(html) {
  const rows = [];
  // Find the first <table> (the "Text" leaderboard is the primary one).
  const tableStart = html.indexOf('<table');
  if (tableStart < 0) return rows;
  const tbodyStart = html.indexOf('<tbody', tableStart);
  if (tbodyStart < 0) return rows;
  const tbodyEnd = html.indexOf('</tbody>', tbodyStart);
  if (tbodyEnd < 0) return rows;
  const tbody = html.slice(tbodyStart, tbodyEnd);

  // Each row: extract the model name from the first <td> (look for
  // `title="..."` which carries the publicName) and the rank integers
  // from the rest of the <td>s.
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let tr;
  while ((tr = trRe.exec(tbody)) !== null) {
    const rowHtml = tr[1];
    // Model name: prefer the title attribute (most stable).
    const titleMatch = /title="([a-z0-9][a-z0-9.\-]*)"/i.exec(rowHtml);
    if (!titleMatch) continue;
    const name = titleMatch[1];

    // Rank positions: every <td> after the name cell carries a
    // single-digit integer (the per-category rank).
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const ranks = [];
    let td;
    while ((td = tdRe.exec(rowHtml)) !== null) {
      const text = td[1].replace(/<[^>]+>/g, '').trim();
      if (/^\d{1,3}$/.test(text)) ranks.push(Number(text));
    }
    if (ranks.length === 0) continue;
    rows.push({ name, ranks });
  }
  return rows;
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

  const rows = parseLeaderboardTable(html);
  if (rows.length === 0) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'parse',
      error: 'No leaderboard rows found. The HTML structure may have changed.',
    });
  }

  // Build a name → ranks map for downstream matching.
  const nameToRanks = new Map();
  for (const r of rows) nameToRanks.set(r.name, r.ranks);

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

  // Match each LMArena name to a model key in our dataset.
  const matched = [];
  const unmatched = [];
  for (const [name, ranks] of nameToRanks) {
    const candidates = candidateKeys(name);
    const key = candidates.find((k) => doc.models[k]);
    if (!key) {
      unmatched.push(name);
      continue;
    }
    matched.push({ name, key, ranks });
  }

  // The LMArena HTML does NOT expose absolute ELO scores — only RANK
  // positions. We log the matches as a presence check but DO NOT modify
  // data/models.json (the `arena` field stays at its last-known value).
  // Future work: integrate LMArena's public JSON API when one ships.
  console.log(`[${SCRAPER_NAME}] matched ${matched.length} model(s) on the leaderboard`);
  for (const m of matched.slice(0, 8)) {
    console.log(`  ${m.name} → ${m.key} (ranks: ${m.ranks.join(',')})`);
  }
  if (unmatched.length > 0) {
    console.log(`[${SCRAPER_NAME}] unmatched: ${unmatched.length} model(s) on leaderboard not in our dataset`);
  }

  return exitWith(0, {
    scraper: SCRAPER_NAME,
    ok: true,
    rows: rows.length,
    matched: matched.length,
    unmatched,
    changes: 0,
    note: 'LMArena HTML exposes rank positions only; no absolute ELO. arena field unchanged.',
  });
}

main();