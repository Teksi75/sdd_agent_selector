#!/usr/bin/env node
// scripts/scrape-glm-blog.js
// Phase 3 scraper — GLM-5.2 launch blog on Hugging Face.
//
// Source: https://huggingface.co/blog/zai-org/glm-52-blog
//
// The blog lists GLM-5.2 benchmark numbers in prose ("81.0 vs. 63.5
// on Terminal-Bench 2.1 and 62.1 vs. 58.4 on SWE-bench Pro"). We
// extract three numbers via regex:
//   - swePro : SWE-bench Pro score
//   - sweVer : SWE-bench Verified score (if present)
//   - term   : Terminal-Bench 2.1 score
//
// Updates only the `glm52` model. If any required number can't be
// found, the scraper exits 1 with a clear message (fail-loud).

import {
  parseArgs,
  readModelsJson,
  writeModelsJson,
  fetchText,
  stripHtml,
  diffModels,
  summarizeDryRun,
  exitWith,
} from './_scraper-utils.mjs';

const SOURCE_URL = 'https://huggingface.co/blog/zai-org/glm-52-blog';
const SCRAPER_NAME = 'scrape-glm-blog';

/**
 * Strip HTML to plain text, then pull out the benchmark numbers.
 *
 * Returns { swePro, sweVer, term } — any value that can't be found is
 * left as null (the caller decides whether to treat null as a fatal
 * miss).
 *
 * @param {string} html
 * @returns {{swePro: number|null, sweVer: number|null, term: number|null}}
 */
function extractBenchmarks(html) {
  const text = stripHtml(html);

  // Terminal-Bench: "81.0 vs. 63.5 on Terminal-Bench 2.1"
  // The first number (81.0) is GLM-5.2; the second (63.5) is GLM-5.1.
  const termMatch = /(\d{2,3}(?:\.\d)?)\s*(?:vs\.?|and|,)?\s*\d{1,3}(?:\.\d)?\s+on\s+Terminal[-\s]Bench/i.exec(text);
  const term = termMatch ? Number(termMatch[1]) : null;

  // SWE-bench Pro: "62.1 vs. 58.4 on SWE-bench Pro"
  const sweProMatch = /(\d{2,3}(?:\.\d)?)\s*(?:vs\.?|and|,)?\s*\d{1,3}(?:\.\d)?\s+on\s+SWE[-\s]?[Bb]ench\s+Pro/i.exec(text);
  const swePro = sweProMatch ? Number(sweProMatch[1]) : null;

  // SWE-bench Verified: "scoring 77.8 on SWE-bench Verified" or similar.
  // Use a broader regex that accepts either the first number after the
  // phrase or the SWE-Pro pattern with "Verified" suffix.
  const sweVerMatch = /(\d{2,3}(?:\.\d)?)\s+on\s+SWE[-\s]?[Bb]ench\s+Verified/i.exec(text);
  const sweVer = sweVerMatch ? Number(sweVerMatch[1]) : null;

  return { swePro, sweVer, term };
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

  const benchmarks = extractBenchmarks(html);

  // Term is the most reliable; if it's missing, the page likely changed.
  if (benchmarks.term == null) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'parse',
      error: 'Could not extract Terminal-Bench score from the blog. The page may have changed.',
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

  if (!updatedModels.glm52) {
    return exitWith(1, {
      scraper: SCRAPER_NAME,
      ok: false,
      phase: 'model',
      error: 'glm52 model entry not found in data/models.json — cannot update.',
    });
  }

  // Preserve existing arena / tier / notes / sources; update only the
  // three benchmark fields + add an entry to `sources`.
  const today = new Date().toISOString().slice(0, 10);
  const existing = updatedModels.glm52;
  const patch = {
    term: benchmarks.term,
    ...(benchmarks.swePro != null ? { swePro: benchmarks.swePro } : {}),
    ...(benchmarks.sweVer != null ? { sweVer: benchmarks.sweVer } : {}),
    sources: [
      ...(Array.isArray(existing.sources) ? existing.sources : []),
      { url, date: today, scraper: SCRAPER_NAME },
    ],
  };
  updatedModels.glm52 = { ...existing, ...patch };

  const changes = diffModels(before, updatedModels);

  if (args.dryRun) {
    summarizeDryRun(SCRAPER_NAME, changes);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      dryRun: true,
      benchmarks,
      changes: changes.length,
    });
  }

  if (changes.length === 0) {
    console.log(`[${SCRAPER_NAME}] no changes — benchmarks already up to date`);
    return exitWith(0, {
      scraper: SCRAPER_NAME,
      ok: true,
      benchmarks,
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

  console.log(`[${SCRAPER_NAME}] wrote ${changes.length} change(s) to glm52`);
  return exitWith(0, {
    scraper: SCRAPER_NAME,
    ok: true,
    benchmarks,
    changes: changes.length,
  });
}

main();