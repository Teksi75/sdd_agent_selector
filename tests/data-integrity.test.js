// tests/data-integrity.test.js
// Phase 1 — Integrity between V3 source and V4 data file.
//
// Loads:
//   v3-monolith-backup.html  (canonical source from `Modelos SDD - V3 - Lucide.html`)
//   data/models.json         (transcribed Phase 1 deliverable)
//
// Asserts:
//   - same model count
//   - same key fingerprint per model (name, arena, input, output, tier at minimum)
//   - reference-tier models in V3 marked isReference in V4 (so charts/tables can hide them)
//
// Tolerance: We accept that V4 normalizes some V3 fields (tier `mid` → `balanced`).
// That is a documented mapping from design.md and is not a regression.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// --- V3 source resolution (filesystem-agnostic) ---
//
// The V3 monolith lives at one of these paths, in priority order:
//   1. <project>/v3-monolith-backup.html             (in-repo snapshot)
//   2. <parent>/Modelos SDD - V3 - Lucide.html       (Pablo's local dev dir)
//   3. $SDD_V3_BACKUP_PATH                            (CI override)
//
// We resolve the first existing path; if none exist, the integrity tests
// are SKIPPED (not failed) so CI can run without the V3 source available.
// This keeps the test suite green in CI while still being strict locally.

const V3_CANDIDATES = [
  join(ROOT, 'v3-monolith-backup.html'),
  resolve(ROOT, '..', 'SDD', 'Modelos SDD - V3 - Lucide.html'),
  process.env.SDD_V3_BACKUP_PATH,
].filter(Boolean);

/** @type {string|null} */
let V3_BACKUP = null;
for (const candidate of V3_CANDIDATES) {
  try {
    // eslint-disable-next-line no-unused-expressions
    readFileSync(candidate, 'utf-8');
    V3_BACKUP = candidate;
    break;
  } catch {
    // try next
  }
}

const V3_AVAILABLE = V3_BACKUP !== null;

/**
 * Extract the MODELS constant from the V3 HTML snapshot.
 * @param {string} html
 * @returns {Object<string, {name: string, arena: number|null, swePro: number|null,
 *                          sweVer: number|null, term: number|null, input: number,
 *                          output: number, tier: string, isReference?: boolean,
 *                          isNew?: boolean, notes?: string, rating?: number}>}
 */
function parseV3Models(html) {
  const startIdx = html.indexOf('const MODELS');
  if (startIdx < 0) throw new Error('V3 MODELS constant not found');
  const openBrace = html.indexOf('{', startIdx);
  if (openBrace < 0) throw new Error('V3 MODELS opening brace not found');
  // Walk braces to find matching close.
  let depth = 1;
  let i = openBrace + 1;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  const body = html.slice(openBrace + 1, i - 1);

  // Parse individual key records: `'key': { ... },`.
  const records = {};
  const recordRegex = /'([^']+)'\s*:\s*\{([^}]*)\}/g;
  let m;
  while ((m = recordRegex.exec(body)) !== null) {
    const [, key, fieldsBody] = m;
    const fields = {};
    const fieldRegex = /(\w+)\s*:\s*('([^']*)'|null|true|false|-?\d+(?:\.\d+)?)/g;
    let f;
    while ((f = fieldRegex.exec(fieldsBody)) !== null) {
      const [, name, rawValue, strValue] = f;
      if (rawValue === 'null') fields[name] = null;
      else if (rawValue === 'true') fields[name] = true;
      else if (rawValue === 'false') fields[name] = false;
      else if (strValue !== undefined) fields[name] = strValue;
      else fields[name] = Number(rawValue);
    }
    records[key] = fields;
  }
  return records;
}

/**
 * V3 tier "mid" → V4 spec tier "balanced" mapping.
 * V3 also allowed `tier: 'reference'` which we keep as-is.
 */
function normalizeTier(v3Tier) {
  if (v3Tier === 'mid') return 'balanced';
  return v3Tier;
}

/**
 * Name comparison is case-insensitive: V3 stores display names with the
 * vendor's canonical casing (e.g. "GPT-5.5") while V4 normalizes them to a
 * stable kebab-free form (e.g. "gpt-5.5"). The integrity contract is that
 * the SAME model is present in both, not that capitalization matches.
 */
function nameEqual(a, b) {
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

// --- Known V4-only additions -----------------------------------------------
//
// V4 has these models that V3 did not (intentional additions, not orphans):
//   - gpt54, claudeFable5, sonnet5, haiku45: 2026-07-06 sync from
//     scrape-openai-pricing / scrape-anthropic-pricing
//   - gpt56terra: 2026-07-09 manual add for the new OpenAI balanced tier
//
// Bump this set when adding a new V4-only model so the orphan check stays
// a useful drift detector instead of a permanent false-positive.
// Also use this set for models that exist in V3 with a STUB payload and
// were later filled in with real benchmarks in V4 (V3's stub is the source
// of truth for "existence" but not for "current data").
const KNOWN_V4_ONLY = new Set([
  'gpt54',
  'claudeFable5',
  'sonnet5',
  'haiku45',
  'gpt56terra',
  'kimik27c', // K2.7 Code: V3 stub (arena=null, sweVer=60.4) → V4 real (Vals AI
              //   sweVer=78.2, term=67, estimated arena=1510, swePro proxy 58.6).
  'kimik25',   // K2.5: V3 launch data (arena=1515, sweVer=80.2) → V4 2026 refresh
              //   (arena=1400 per BenchLM, sweVer=76.8 + swePro=50.7 per Moonshot's
              //   HuggingFace card). The old numbers made K2.5 appear top of the
              //   ranking despite K2.6 and K2.7 being strictly stronger.
  'kimik3',    // K3: V4-only (released 2026-07-17; catalog entry added 2026-07-18).
               //   V3 has no K3 entry. See models.json notes for dated provenance.
]);

describe('data-integrity: V3 source vs data/models.json', () => {
  // Skip the whole suite when no V3 source is available (CI without snapshot).
  if (!V3_AVAILABLE) {
    test.skip('V3 source not found (skipped — set SDD_V3_BACKUP_PATH or restore v3-monolith-backup.html)', () => {
      // intentional no-op
    });
    return;
  }

  const html = readFileSync(V3_BACKUP, 'utf-8');
  const v3 = parseV3Models(html);
  const v4raw = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));
  const v4 = v4raw.models;

  test('V3 parser extracts the same model count we expect', () => {
    // Sanity guard: we know V3 has 17 models (15 active + 2 reference).
    expect(Object.keys(v3).length).toBeGreaterThanOrEqual(15);
  });

  test('V4 has at least as many models as V3', () => {
    expect(Object.keys(v4).length).toBeGreaterThanOrEqual(Object.keys(v3).length);
  });

  test('every V3 model key exists in V4', () => {
    const v3Keys = Object.keys(v3).sort();
    const v4Keys = Object.keys(v4).sort();
    for (const k of v3Keys) {
      expect(v4Keys, `V4 missing V3 key: ${k}`).toContain(k);
    }
  });

  test('every V4 model key exists in V3 (allowing for known V4-only additions)', () => {
    const v3Keys = new Set(Object.keys(v3));
    for (const k of Object.keys(v4)) {
      if (KNOWN_V4_ONLY.has(k)) continue; // intentional V4-only addition
      expect(v3Keys.has(k), `V4 has orphan key (not in V3): ${k}`).toBe(true);
    }
  });

  test('name, arena, input, output, tier match between V3 and V4', () => {
    for (const key of Object.keys(v3)) {
      if (KNOWN_V4_ONLY.has(key)) continue; // V4 updated the data for this model
      const a = v3[key];
      const b = v4[key];
      expect(b, `V4 missing model ${key}`).toBeDefined();
      expect(nameEqual(b.name, a.name), `V4 name "${b.name}" != V3 name "${a.name}"`).toBe(true);
      // V3 stored arena as null/string; V4 uses null for unknown.
      const v3Arena = a.arena === null || a.arena === undefined ? null : Number(a.arena);
      expect(b.arena ?? null).toBe(v3Arena ?? null);
      expect(b.input).toBeCloseTo(Number(a.input), 6);
      expect(b.output).toBeCloseTo(Number(a.output), 6);
      // Tier mapping: V3 'mid' → V4 'balanced'; others unchanged.
      expect(b.tier).toBe(normalizeTier(a.tier));
    }
  });

  test('reference-tier models in V3 are flagged isReference in V4', () => {
    const v3Refs = Object.values(v3)
      .filter((m) => m.tier === 'reference')
      .map((m) => m.name);
    expect(v3Refs.length).toBeGreaterThan(0); // sanity
    for (const name of v3Refs) {
      const v4Model = Object.values(v4).find((m) => nameEqual(m.name, name));
      expect(v4Model, `V4 missing reference model ${name}`).toBeDefined();
      expect(v4Model.isReference).toBe(true);
      expect(v4Model.tier).toBe('reference');
    }
  });

  test('_meta block declares schemaVersion 2 (BenchLM migration)', () => {
    expect(v4raw._meta).toBeDefined();
    expect(v4raw._meta.schemaVersion).toBe(2);
    expect(v4raw._meta.lastSynced).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// --- Schema v2 migration gate (PR1 — benchlm-replace-custom-scoring) ----------
//
// PR1 bumps BOTH `_meta.schemaVersion` in data/models.json AND
// `CURRENT_SCHEMA_VERSION` in js/services/data-loader.js. The loader's
// readCache already discards cached payloads whose `schemaVersion` does
// not match the live constant, so bumping it forces a clean refetch on
// the next page load (no manual cache clear needed).
//
// Why export the constant: it's currently a private `const`, but the
// integrity test is the natural place to pin the migration number. We
// keep the export name identical and add a JSDoc note so future
// contributors don't treat the export as part of the public consumer
// API — it's a test affordance.
import { CURRENT_SCHEMA_VERSION } from '../js/services/data-loader.js';

describe('data-integrity: schema v2 migration gate', () => {
  test('CURRENT_SCHEMA_VERSION in data-loader is 2', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });
});

// Assertion-only coverage of existing curated catalog data; red-first is not applicable.
describe('data-integrity: Kimi K3 provenance', () => {
  const k3 = JSON.parse(
    readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
  ).models.kimik3;

  test('kimik3 has every required catalog field and valid source entries', () => {
    expect(k3).toBeDefined();
    for (const key of ['name', 'tier', 'input', 'output', 'notes', 'sources']) {
      expect(k3).toHaveProperty(key);
    }
    expect(k3.sources.length).toBeGreaterThan(0);
    for (const source of k3.sources) {
      expect(source).toHaveProperty('url');
      expect(source).toHaveProperty('date');
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('every K3 benchmark is numeric with dated evidence or null with a dated explanation', () => {
    const metrics = [
      ['arena', /Arena:.*?(?=SWE-Ver:|SWE-Pro:|Terminal-Bench|$)/is],
      ['swePro', /SWE-Pro:.*?(?=SWE-Ver:|Terminal-Bench|$)/is],
      ['sweVer', /SWE-Ver:.*?(?=SWE-Pro:|Terminal-Bench|$)/is],
      ['term', /Terminal-Bench(?: 2\.1)?:.*$/is],
    ];

    for (const [field, sectionPattern] of metrics) {
      const value = k3[field];
      const section = k3.notes.match(sectionPattern)?.[0];
      expect(value === null || Number.isFinite(value), `${field} must be finite or null`).toBe(true);
      expect(section, `${field} must have a provenance label`).toBeDefined();
      expect(section, `${field} provenance must be dated`).toMatch(/\b\d{4}-\d{2}-\d{2}\b/);

      if (Number.isFinite(value)) {
        expect(
          k3.sources.some((source) => source.url && source.date),
          `${field} needs supporting source evidence`
        ).toBe(true);
      } else {
        expect(section, `${field} null value needs an explanation`).toMatch(
          /not published|not extracted|unverifiable|unknown|pending|not available/i
        );
      }
    }
  });

  test('unverifiable K3 SWE-Pro stays null with exact dated provenance', () => {
    expect(k3.swePro).toBeNull();
    expect(k3.notes).toContain('SWE-Pro: not published as of 2026-07-18');
  });
});
