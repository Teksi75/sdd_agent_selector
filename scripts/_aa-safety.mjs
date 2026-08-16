// scripts/_aa-safety.mjs
// Pure helpers for the Artificial Analysis scraper — alias v2 + slug safety
// (Effort PR 1). No I/O beyond the alias-file load; the scraper handles
// fetch + parse + write.
//
// Exports (v2 contract):
//
//   - loadAaAliases(filePath)
//       Read + parse data/aa-aliases.json. Throws on missing file, malformed
//       JSON, or missing `aliases` array. For v2 files (`_meta.version === 2`)
//       every entry MUST be `{slug, to, effort}` with a valid effort enum
//       value — a missing/invalid `effort` is a hard error (effort is NEVER
//       inferred from slug shape). Legacy v1-shaped files (`{from,slug,to}`)
//       load leniently so the pre-PR-2 scraper keeps working.
//       Returns the array of alias entries.
//
//   - mapAaSlug(slug, aliases)
//       Map a curated AA slug → `{to, effort}`. Unknown non-curated slugs
//       return null — they are IGNORED, not fatal (AA lists ~539 models we
//       do not curate). A missing/empty slug is expected-but-absent and
//       throws `Error` with `.code === 'AA_UNKNOWN_SLUG'` (fail closed).
//
//   - detectRename(id, slug, aliases)
//       Slug-based drift guard (v2): the slug IS the identity, so a known
//       slug never fails — a changed UUID is not fatal (known slugs update)
//       and an unknown non-curated slug is ignored. A missing slug is
//       expected-but-absent and fails closed with `AA_UNKNOWN_SLUG`. Legacy
//       v1 alias entries (with `from`) keep the old id-drift check
//       (`AA_ID_RENAMED`) as a PR-1 compatibility shim.
//
//   - mapAaId(identity, aliases)      [LEGACY shim — removed in PR 2]
//       Delegates to slug lookup and returns the `to` key so the pre-PR-2
//       scraper keeps working. Unknown identities throw `AA_UNKNOWN_ID`.
//
//   - detectMissing(knownIds, mappedPresent)
//       Curated keys we track but AA did NOT mention. The caller WARNs per
//       missing key and PRESERVES the curated record — known-key-disappear
//       is not fatal (mirrors _benchlm-safety.detectMissing).

import { readFileSync, existsSync } from 'node:fs';

/** Valid effort values (spec enum). Explicit per alias; never inferred. */
export const AA_EFFORTS = ['max', 'xhigh', 'high', 'medium', 'low', 'non-reasoning'];

/**
 * Read + parse the AA alias table. The file is expected to live at
 * `data/aa-aliases.json` and to contain `{ _meta, aliases: [...] }`.
 *
 * @param {string} filePath
 * @returns {Array<{slug: string, to: string, effort: string}>}
 */
export function loadAaAliases(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`aa-aliases.json not found at ${filePath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`aa-aliases.json is not valid JSON (${err.message})`);
  }
  if (!parsed || !Array.isArray(parsed.aliases)) {
    throw new Error('aa-aliases.json missing top-level `aliases` array');
  }
  const aliases = parsed.aliases;
  if (parsed._meta && parsed._meta.version === 2) {
    for (let i = 0; i < aliases.length; i++) {
      const a = aliases[i];
      if (!a || typeof a.slug !== 'string' || a.slug.length === 0) {
        throw new Error(`aa-aliases.json aliases[${i}]: missing non-empty \`slug\``);
      }
      if (typeof a.to !== 'string' || a.to.length === 0) {
        throw new Error(`aa-aliases.json aliases[${i}] (slug "${a.slug}"): missing non-empty \`to\``);
      }
      if (!AA_EFFORTS.includes(a.effort)) {
        throw new Error(
          `aa-aliases.json aliases[${i}] (slug "${a.slug}"): missing/invalid \`effort\` ` +
            `(${JSON.stringify(a.effort)}); expected one of ${AA_EFFORTS.join('|')}`,
        );
      }
    }
  }
  return aliases;
}

/**
 * Map a curated AA slug → `{to, effort}`. Unknown non-curated slugs return
 * null (IGNORED — the other ~539 models). A missing/empty slug is
 * expected-but-absent → throws `Error` with `.code === 'AA_UNKNOWN_SLUG'`.
 *
 * @param {string|undefined} slug
 * @param {Array<{slug: string, to: string, effort: string}>} aliases
 * @returns {{to: string, effort: string}|null}
 */
export function mapAaSlug(slug, aliases) {
  if (!slug) {
    const err = new Error('Artificial Analysis entry missing slug (expected-but-absent) — cannot map identity');
    err.code = 'AA_UNKNOWN_SLUG';
    throw err;
  }
  const hit = (aliases || []).find((a) => a && a.slug === slug);
  if (!hit) return null;
  return { to: hit.to, effort: hit.effort };
}

/**
 * Slug-based drift guard. v2 aliases (no `from`): a known slug is the
 * identity — a changed UUID is NOT fatal (known slugs update); an unknown
 * non-curated slug is ignored; a missing slug fails closed with
 * `AA_UNKNOWN_SLUG`. Legacy v1 aliases (with `from`) keep the old id-drift
 * check (`AA_ID_RENAMED` naming old/new id) as a PR-1 compatibility shim.
 *
 * @param {string|undefined} id
 * @param {string|undefined} slug
 * @param {Array} aliases
 * @returns {null}
 */
export function detectRename(id, slug, aliases) {
  if (!slug) {
    const err = new Error(
      `Artificial Analysis entry missing slug (id: ${id ?? '?'}) — expected-but-absent; cannot map identity`,
    );
    err.code = 'AA_UNKNOWN_SLUG';
    throw err;
  }
  const hit = (aliases || []).find((a) => a && a.slug === slug);
  if (!hit) return null; // unknown non-curated slug — IGNORED
  if (hit.from === undefined) return null; // v2: slug IS the identity
  if (hit.from !== id) {
    const err = new Error(`Artificial Analysis id renamed: ${hit.from} → ${id} (slug "${slug}" unchanged)`);
    err.code = 'AA_ID_RENAMED';
    err.oldId = hit.from;
    err.newId = id;
    throw err;
  }
  return null;
}

/**
 * LEGACY compatibility shim (removed in PR 2): delegates to slug lookup and
 * returns the `to` key so the pre-PR-2 scraper keeps working. Unknown
 * identities throw `Error` with `.code === 'AA_UNKNOWN_ID'` naming the
 * offending identity — fail loud, never guess.
 *
 * @param {string} identity
 * @param {Array} aliases
 * @returns {string} the curated key
 */
export function mapAaId(identity, aliases) {
  const hit = (aliases || []).find(
    (a) => a && (a.slug === identity || (a.from !== undefined && a.from === identity)),
  );
  if (!hit) {
    const err = new Error(`unknown Artificial Analysis id: ${identity} (not in aa-aliases.json)`);
    err.code = 'AA_UNKNOWN_ID';
    err.aaId = identity;
    throw err;
  }
  return hit.to;
}

/**
 * Return the curated keys we track but AA did NOT mention. `knownIds` is
 * the set of curated keys in data/models.json (or a subset you care about);
 * `mappedPresent` is a `Set<string>` of curated keys AA DID mention after
 * alias mapping. Result is a sorted array of tracked-but-absent keys. The
 * caller warns and preserves — never delete.
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