#!/usr/bin/env node
// scripts/scrape-anthropic-pricing.js
// Phase 3 scraper — Anthropic pricing page (API pricing block).
//
// Source: https://www.anthropic.com/pricing
//
// Parses each `.card_pricing_api_wrap` block: model name (`<h3>`), input
// price (`data-value` next to "Input" label), output price (next to
// "Output"), and prompt caching Write/Read prices.
//
// Updates 4 models in data/models.json:
//   - claudeFable5  (Fable 5): tier "high"
//   - opus48        (Opus 4.8): tier "reference", isReference: true
//   - sonnet5       (Sonnet 5): tier "balanced"
//   - haiku45       (Haiku 4.5): tier "budget"
//
// Per spec: Opus 4.8 is the `reference` model — `findReferenceModel`
// in model-scorer.js picks it via tier === 'reference'. Fable 5 is
// Anthropic's flagship, Sonnet 5 is the balanced mid-tier, Haiku 4.5 is
// the cheapest tier.

import {
  parseArgs,
  readModelsJson,
  writeModelsJson,
  fetchText,
  diffModels,
  summarizeDryRun,
  exitWith,
} from './_scraper-utils.mjs';

const SOURCE_URL = 'https://www.anthropic.com/pricing';
const SCRAPER_NAME = 'scrape-anthropic-pricing';

/**
 * Map: the exact text we see on the page → { key, tier, isReference? }
 */
const NAME_MAP = {
  'Fable 5': { key: 'claudeFable5', tier: 'high', display: 'Claude Fable 5' },
  'Opus 4.8': { key: 'opus48', tier: 'reference', isReference: true, display: 'Claude Opus 4.8' },
  'Sonnet 5': { key: 'sonnet5', tier: 'balanced', display: 'Claude Sonnet 5' },
  'Haiku 4.5': { key: 'haiku45', tier: 'budget', display: 'Claude Haiku 4.5' },
};

/**
 * Parse every "API pricing" card on the page. Each card is a
 * `.card_pricing_api_wrap` div with structure:
 *   <div class="card_pricing_api_wrap ...">
 *     <h3 class="card_pricing_title_text ...">{name}</h3>
 *     <div tokens_main_label>Input</div>
 *       <span data-value="X">{X}</span>
 *     <div tokens_main_label>Output</div>
 *       <span data-value="X">{X}</span>
 *     <div tokens_main_label>Prompt caching</div>
 *       <div tokens_main_label>Write</div>
 *         <span data-value="X">{X}</span>
 *       <div tokens_main_label>Read</div>
 *         <span data-value="X">{X}</span>
 *   </div>
 *
 * @param {string} html
 * @returns {Array<{name: string, input: number|null, output: number|null, cacheWrite: number|null, cacheRead: number|null}>}
 */
function parseApiCards(html) {
  const cards = [];
  // Match each card_pricing_api_wrap div (no nested cards in Anthropic).
  // The opening tag may have attributes before the class attribute
  // (e.g. `data-animate-card-card="" data-stagger="" class="..."`), so
  // we accept any attributes between `<div` and `class=`.
  const cardRe = /<div\b[^>]*class="card_pricing_api_wrap[^"]*"[^>]*>([\s\S]*?)(?=<div\b[^>]*class="card_pricing_api_wrap|<\/section>|$)/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const cardBody = m[1];
    // Find model name.
    const nameRe = /card_pricing_title_text[^>]*>([^<]+)<\/h3>/;
    const nameMatch = nameRe.exec(cardBody);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    // Extract label/value pairs (label is in tokens_main_label div,
    // value is in the next data-value span).
    const dataValueRe = /<div\s+class="tokens_main_label[^"]*">([^<]+)<\/div>[\s\S]*?<span\s+data-value="([^"]+)"\s+class="tokens_main_val_number">[^<]+<\/span>/g;
    const pairs = [];
    let dm;
    while ((dm = dataValueRe.exec(cardBody)) !== null) {
      pairs.push({ label: dm[1].trim().toLowerCase(), value: Number(dm[2]) });
    }
    if (pairs.length < 2) continue;

    const input = pairs.find((p) => p.label === 'input')?.value ?? null;
    const output = pairs.find((p) => p.label === 'output')?.value ?? null;
    const cacheWrite = pairs.find((p) => p.label === 'write')?.value ?? null;
    const cacheRead = pairs.find((p) => p.label === 'read')?.value ?? null;

    cards.push({ name, input, output, cacheWrite, cacheRead });
  }
  return cards;
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

  const cards = parseApiCards(html);
  if (cards.length === 0) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'parse',
      error: 'No API pricing cards found. The page structure may have changed.',
    });
  }

  // Build a map: card name → record.
  const byName = {};
  for (const c of cards) byName[c.name] = c;

  // Find each known model.
  const matched = [];
  const unmatched = [];
  for (const [displayName, info] of Object.entries(NAME_MAP)) {
    const card = byName[displayName];
    if (!card) {
      unmatched.push(displayName);
      continue;
    }
    matched.push({ info, card });
  }

  if (matched.length === 0) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'match',
      error: `Found ${cards.length} card(s) but none matched the expected models.`,
      found: cards.map((c) => c.name),
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
  const updatedModels = { ...doc.models };
  const updated = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const { info, card } of matched) {
    const existing = updatedModels[info.key];
    const patch = {
      name: info.display,
      tier: info.tier,
    };
    if (Number.isFinite(card.input)) patch.input = card.input;
    if (Number.isFinite(card.output)) patch.output = card.output;
    if (Number.isFinite(card.cacheRead)) patch.cacheRead = card.cacheRead;
    if (Number.isFinite(card.cacheWrite)) patch.cacheWrite = card.cacheWrite;
    if (info.isReference) {
      patch.isReference = true;
    }
    if (existing) {
      if (!Number.isFinite(patch.input) && Number.isFinite(existing.input)) {
        patch.input = existing.input;
      }
      if (!Number.isFinite(patch.output) && Number.isFinite(existing.output)) {
        patch.output = existing.output;
      }
      updatedModels[info.key] = { ...existing, ...patch };
    } else {
      patch.sources = [{ url, date: today }];
      updatedModels[info.key] = patch;
    }
    updated.push(info.key);
  }

  const changes = diffModels(before, updatedModels);

  if (args.dryRun) {
    summarizeDryRun(SCRAPER_NAME, changes);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      dryRun: true,
      cards: cards.length,
      updated: updated.length,
      unmatched,
      changes: changes.length,
    });
  }

  if (changes.length === 0) {
    console.log(`[${SCRAPER_NAME}] no changes detected`);
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

  console.log(`[${SCRAPER_NAME}] wrote ${changes.length} change(s) across ${updated.length} model(s)`);
  return exitWith(0, {
    scraper: SCRAPER_NAME,
    ok: true,
    updated: updated.length,
    unmatched,
    changes: changes.length,
  });
}

main();