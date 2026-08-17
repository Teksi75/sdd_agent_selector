// scripts/_aa-safety.mjs
// Pure helpers for the Artificial Analysis scraper. No I/O beyond the
// alias-file load; the scraper handles fetch + parse + write.
//
// Four exports:
//
//   - loadAaAliases(filePath)
//       Read + parse data/aa-aliases.json. Throws on missing file,
//       malformed JSON, or missing `aliases` key. Returns the array of
//       `{from, slug, to}` records.
//
//   - mapAaId(identity, aliases)
//       Map an AA identity — the response entry's `id` OR its `slug` —
//       to the curated key used in data/models.json. Throws `Error`
//       with `.code === 'AA_UNKNOWN_ID'` and the offending identity in
//       the message when it is not in the alias table. This is the
//       safety net that prevents the scraper from silently dropping a
//       model AA just published.
//
//   - detectRename(id, slug, aliases)
//       Flag an upstream identity change: when a response entry's
//       `slug` still matches a known alias but its `id` no longer
//       matches that alias `from`, the upstream renamed the id while
//       keeping the human-readable slug stable. Throws `Error` with
//       `.code === 'AA_ID_RENAMED'` naming the old and new id — flag,
//       never guess. Returns null when no rename is detected.
//
//   - detectMissing(knownIds, mappedPresent)
//       Given the set of curated keys we track (`knownIds`) and the set
//       of curated keys AA DID mention (after alias mapping,
//       `mappedPresent`), return the curated keys that were tracked but
//       absent. The caller logs a WARN per missing id and PRESERVES the
//       curated record — known-id-disappear is not fatal (mirrors
//       _benchlm-safety.detectMissing exactly).

import { readFileSync, existsSync } from 'node:fs';

/**
 * Read + parse the AA alias table. The file is expected to live at
 * `data/aa-aliases.json` and to contain `{ _meta, aliases: [...] }`.
 *
 * @param {string} filePath
 * @returns {Array<{from: string, slug: string, to: string}>}
 */
export function loadAaAliases(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`aa-aliases.json not found at ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`aa-aliases.json is not valid JSON (${err.message})`);
  }
  if (!parsed || !Array.isArray(parsed.aliases)) {
    throw new Error('aa-aliases.json missing top-level `aliases` array');
  }
  return parsed.aliases;
}

/**
 * Map a single AA identity — either the response `id` or the response
 * `slug` — to the curated key in data/models.json. Throws `Error` with
 * `.code === 'AA_UNKNOWN_ID'` when the identity is not present in the
 * alias table.
 *
 * @param {string} identity
 * @param {Array<{from: string, slug: string, to: string}>} aliases
 * @returns {string} the curated key
 */
export function mapAaId(identity, aliases) {
  const hit = aliases.find((a) => a && (a.from === identity || a.slug === identity));
  if (!hit) {
    const err = new Error(`unknown Artificial Analysis id: ${identity} (not in aa-aliases.json)`);
    err.code = 'AA_UNKNOWN_ID';
    err.aaId = identity;
    throw err;
  }
  return hit.to;
}

/**
 * Flag an AA id rename. A response entry whose `slug` matches a known
 * alias `slug` but whose `id` differs from that alias `from` means the
 * upstream renamed the id while keeping the slug stable. Throws `Error`
 * with `.code === 'AA_ID_RENAMED'` naming the old and new id so the
 * operator can update the alias table — flag, never guess.
 *
 * Returns null when no rename is detected (slug unknown, slug missing,
 * or id still matches the alias).
 *
 * @param {string} id
 * @param {string|undefined} slug
 * @param {Array<{from: string, slug: string, to: string}>} aliases
 * @returns {null}
 */
export function detectRename(id, slug, aliases) {
  if (!slug) return null;
  const hit = aliases.find((a) => a && a.slug === slug && a.from !== id);
  if (!hit) return null;
  const err = new Error(`Artificial Analysis id renamed: ${hit.from} → ${id} (slug "${slug}" unchanged)`);
  err.code = 'AA_ID_RENAMED';
  err.oldId = hit.from;
  err.newId = id;
  throw err;
}

/**
 * Return the curated keys that we track but AA did NOT mention.
 *
 * `knownIds` is the full set of curated keys in data/models.json (or a
 * subset you care about). `mappedPresent` is a `Set<string>` of curated
 * keys AA DID mention, after alias mapping. The result is an array
 * (sorted for stable output) of curated keys that are in `knownIds` but
 * not in `mappedPresent`. The caller warns and preserves — never delete.
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
