// scripts/_benchlm-safety.mjs
// Pure helpers for the BenchLM scraper. No I/O beyond the alias-file
// load; the scraper handles fetch + parse + write.
//
// Three exports:
//
//   - loadAliases(filePath)
//       Read + parse data/benchlm-aliases.json. Throws on missing file,
//       malformed JSON, or missing `aliases` key. Returns the array of
//       `{from, to}` records.
//
//   - mapBenchlmId(benchlmId, aliases)
//       Map a BenchLM id to the curated key used in data/models.json.
//       Throws `Error` with `.code === 'BENCHLM_UNKNOWN_ID'` and the
//       offending BenchLM id in the message when the id is not in the
//       alias table. This is the safety net that prevents the scraper
//       from silently dropping a model BenchLM just published.
//
//   - detectMissing(knownIds, mappedPresent)
//       Given the set of curated keys we track (`knownIds`) and the set
//       of curated keys BenchLM DID mention (after alias mapping,
//       `mappedPresent`), return the curated keys that were tracked but
//       absent. The caller logs a WARN per missing id and PRESERVES the
//       curated record — known-id-disappear is not fatal (per spec
//       "Known id disappears" in benchlm-rename-detection).

import { readFileSync, existsSync } from 'node:fs';

/**
 * Read + parse the BenchLM alias table. The file is expected to live at
 * `data/benchlm-aliases.json` and to contain `{ _meta, aliases: [...] }`.
 *
 * @param {string} filePath
 * @returns {Array<{from: string, to: string}>}
 */
export function loadAliases(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`benchlm-aliases.json not found at ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`benchlm-aliases.json is not valid JSON (${err.message})`);
  }
  if (!parsed || !Array.isArray(parsed.aliases)) {
    throw new Error('benchlm-aliases.json missing top-level `aliases` array');
  }
  return parsed.aliases;
}

/**
 * Map a single BenchLM id to the curated key in data/models.json.
 * Throws `Error` with `.code === 'BENCHLM_UNKNOWN_ID'` when the id is
 * not present in the alias table.
 *
 * @param {string} benchlmId
 * @param {Array<{from: string, to: string}>} aliases
 * @returns {string} the curated key
 */
export function mapBenchlmId(benchlmId, aliases) {
  const hit = aliases.find((a) => a && a.from === benchlmId);
  if (!hit) {
    const err = new Error(`unknown BenchLM id: ${benchlmId} (not in benchlm-aliases.json)`);
    err.code = 'BENCHLM_UNKNOWN_ID';
    err.benchlmId = benchlmId;
    throw err;
  }
  return hit.to;
}

/**
 * Return the curated keys that we track but BenchLM did NOT list.
 *
 * `knownIds` is the full set of curated keys in data/models.json (or a
 * subset you care about). `mappedPresent` is a `Set<string>` of curated
 * keys BenchLM DID mention, after alias mapping. The result is an array
 * (sorted for stable output) of curated keys that are in `knownIds` but
 * not in `mappedPresent`.
 *
 * @param {string[]} knownIds
 * @param {Set<string>} mappedPresent
 * @returns {string[]}
 */
export function detectMissing(knownIds, mappedPresent) {
  const present = mappedPresent instanceof Set ? mappedPresent : new Set(mappedPresent || []);
  const missing = [];
  for (const id of knownIds || []) {
    if (!present.has(id)) missing.push(id);
  }
  return missing.sort();
}
