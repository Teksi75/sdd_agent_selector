#!/usr/bin/env node
// scripts/scrape-swebench-leaderboard.js
// Phase 3 scraper — SWE-bench Verified leaderboard.
//
// Source: https://www.swebench.com/
//
// Per spec: this scraper is "fail-loud-but-non-blocking". It tries to
// fetch the page and parse the per-instance JSON data into an aggregate
// resolved_pct per model. If the parse fails (the page is JS-heavy and
// may not embed the aggregate in static HTML), it logs a warning and
// exits 0 — the other scrapers can still run.
//
// For each tracked model whose name matches a SWE-bench entry, we
// update `sweVer` with the computed resolved_pct.
//
// The HTML embeds per-instance results as JSON inside a script tag
// (or a data island). The data structure looks like:
//   {"Claude 4.5 Opus (high reasoning)": {
//     "os_model": false,
//     "per_instance_details": {
//       "astropy__astropy-12907": {"api_calls": 32, "cost": ..., "resolved": true},
//       ...
//     }
//   }}
//
// We aggregate `resolved: true` count / total instances × 100 → percent.

import {
  parseArgs,
  readModelsJson,
  writeModelsJson,
  fetchText,
  diffModels,
  summarizeDryRun,
  exitWith,
} from './_scraper-utils.mjs';
import { mergeSweBenchResults } from './swebench-merge.mjs';

const SOURCE_URL = 'https://www.swebench.com/';
const SCRAPER_NAME = 'scrape-swebench-leaderboard';

/**
 * Map: SWE-bench display name fragment → model key in data/models.json.
 * We match by lowercase substring because SWE-bench uses varied naming
 * (e.g. "Claude 4.5 Opus (high reasoning)" — we want it to match our
 * opus48 via "opus 4" substring).
 */
const NAME_PATTERNS = [
  { match: /opus\s*4[\.\-]?8/i, key: 'opus48' },
  { match: /fable\s*5/i, key: 'claudeFable5' },
  { match: /sonnet\s*5/i, key: 'sonnet5' },
  { match: /haiku\s*4[\.\-]?5/i, key: 'haiku45' },
  { match: /gpt-?5[\.\-]?5/i, key: 'gpt55' },
  { match: /gpt-?5[\.\-]?4/i, key: 'gpt54' },
  { match: /gpt-?5[\.\-]?2/i, key: 'gpt52' },
  { match: /deepseek\s*v4\s*pro/i, key: 'deepseekv4p' },
  { match: /deepseek\s*v4\s*flash/i, key: 'deepseekv4f' },
  { match: /qwen3[\.\-]?7\s*max/i, key: 'qwen37max' },
  { match: /qwen3[\.\-]?7\s*plus/i, key: 'qwen37plus' },
  { match: /qwen3[\.\-]?6\s*plus/i, key: 'qwen36plus' },
  { match: /kimi\s*k2[\.\-]?6/i, key: 'kimik26' },
  { match: /kimi\s*k2[\.\-]?7/i, key: 'kimik27c' },
  { match: /minimax\s*m3/i, key: 'minimaxm3' },
  { match: /minimax\s*m2[\.\-]?7/i, key: 'minimaxm27' },
  { match: /mimo[\-\s]*v2[\.\-]?5[\-\s]*pro/i, key: 'mimo25pro' },
  { match: /mimo[\-\s]*v2[\.\-]?5(?!\s*pro)/i, key: 'mimo25' },
  { match: /glm[\-\s]*5[\.\-]?2/i, key: 'glm52' },
  { match: /glm[\-\s]*5[\.\-]?1/i, key: 'glm51' },
];

/**
 * Walk the page text and try to locate every "{name}": {... per_instance_details ...}"
 * blob. We use a depth-tracking scan since the blob can span many
 * kilobytes and we don't want to depend on a perfect top-level JSON
 * parse (the page may have JS that wraps the data with extra context).
 *
 * For each model, count `resolved: true` over total instances.
 *
 * @param {string} html
 * @returns {Map<string, {resolved: number, total: number, pct: number}>}
 */
function computeResolvedPct(html) {
  const out = new Map();

  // Strategy: find every occurrence of `"per_instance_details":{...}`
  // using a depth-tracking scan, then walk BACKWARDS to find the
  // enclosing model-name key (the first `"..."` before the object).
  const start = html.indexOf('per_instance_details');
  if (start < 0) return out;

  // Collect ALL per_instance_details blobs in the page (one per model).
  const blobs = [];
  const re = /per_instance_details/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const blobStart = m.index;
    // Walk forward from `:` after the field name.
    let i = blobStart;
    while (i < html.length && html[i] !== ':') i++;
    i++; // skip the colon
    while (i < html.length && /\s/.test(html[i])) i++;
    if (html[i] !== '{') continue;
    // Depth-scan to find the matching `}`.
    let depth = 0;
    const objStart = i;
    while (i < html.length) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) { i++; break; }
      }
      i++;
    }
    const blob = html.slice(objStart, i);
    blobs.push({ keyOffset: blobStart, blob });
  }

  for (const { keyOffset, blob } of blobs) {
    // Count resolved: true vs total.
    const resolvedMatches = blob.match(/"resolved"\s*:\s*true/g) || [];
    const anyResolvedMatches = blob.match(/"resolved"\s*:\s*(true|false)/g) || [];
    const resolved = resolvedMatches.length;
    const total = anyResolvedMatches.length;
    if (total === 0) continue;
    const pct = Math.round((resolved / total) * 1000) / 10;

    // Find model name: the per_instance_details is preceded by `os_model`,
    // `os_system`, and `name` fields. Walk backwards to find the last
    // `"name": "..."` before this blob.
    const before = html.slice(Math.max(0, keyOffset - 5000), keyOffset);
    const nameMatches = [...before.matchAll(/"name"\s*:\s*"([^"]+)"/g)];
    if (nameMatches.length === 0) continue;
    const nameMatch = nameMatches[nameMatches.length - 1];
    const name = nameMatch[1];
    out.set(name, { resolved, total, pct });
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = args.source || SOURCE_URL;

  let html;
  try {
    html = await fetchText(url);
  } catch (err) {
    // Per spec: SWE-bench is "fail-loud-but-non-blocking". Log + exit 0.
    console.warn(`[${SCRAPER_NAME}] fetch failed (${err.message}) — leaving sweVer unchanged`);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      stale_fallback: true,
      reason: 'fetch failed',
      error: err.message,
      changes: 0,
    });
  }

  const resolvedMap = computeResolvedPct(html);
  if (resolvedMap.size === 0) {
    console.warn(`[${SCRAPER_NAME}] no per_instance_details data found in HTML — leaving sweVer unchanged`);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      stale_fallback: true,
      reason: 'no per_instance_details blobs',
      changes: 0,
    });
  }

  // Match each SWE-bench name to a model key.
  const matched = [];
  for (const [name, stats] of resolvedMap) {
    for (const { match, key } of NAME_PATTERNS) {
      if (match.test(name)) {
        matched.push({ name, key, stats });
        break;
      }
    }
  }

  if (matched.length === 0) {
    console.warn(`[${SCRAPER_NAME}] no SWE-bench entries matched our models — leaving sweVer unchanged`);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      stale_fallback: true,
      reason: 'no matches',
      entries: resolvedMap.size,
      changes: 0,
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

  const before = JSON.parse(JSON.stringify(doc.models));
  const today = new Date().toISOString().slice(0, 10);
  const updatedModels = mergeSweBenchResults(
    doc.models,
    matched,
    url,
    today,
    SCRAPER_NAME
  );

  const changes = diffModels(before, updatedModels);

  if (args.dryRun) {
    summarizeDryRun(SCRAPER_NAME, changes);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      dryRun: true,
      entries: resolvedMap.size,
      matched: matched.length,
      changes: changes.length,
    });
  }

  if (changes.length === 0) {
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      entries: resolvedMap.size,
      matched: matched.length,
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

  console.log(`[${SCRAPER_NAME}] wrote ${changes.length} change(s) across ${matched.length} model(s)`);
  return exitWith(0, {
    scraper: SCRAPER_NAME,
    ok: true,
    entries: resolvedMap.size,
    matched: matched.length,
    changes: changes.length,
  });
}

main();
