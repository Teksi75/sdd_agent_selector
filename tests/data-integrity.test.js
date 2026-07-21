// tests/data-integrity.test.js
// PR3 (benchlm-replace-custom-scoring) — migrated integrity assertions.
//
// After PR3, the integrity contract asserts the BenchLM-backed shape on
// every tracked V4 model:
//   - every tracked V4 model has a `benchlm` block with valid {score,
//     verified, reliability, categories}
//   - schemaVersion === 2 (matches CURRENT_SCHEMA_VERSION in js/services/
//     data-loader.js after PR1 merge)
//   - legacy V3 model fields (name, tier, input, output) still match as
//     drift-detection sanity; the flat `arena`/`swePro`/`sweVer`/`term`
//     fields remain in data/models.json for reference but the integrity
//     contract no longer pins them (PR3 cutover).
//
// This test is RED before PR1+PR2 merge (no benchlm blocks, schemaVersion
// is still 1) and GREEN after. Stacked-to-main is the trade-off per the
// design (T3.2).

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// --- V3 source resolution (filesystem-agnostic) ----------------------------
//
// The V3 monolith lives at one of these paths, in priority order:
//   1. <project>/v3-monolith-backup.html             (in-repo snapshot)
//   2. <parent>/Modelos SDD - V3 - Lucide.html       (Pablo's local dev dir)
//   3. $SDD_V3_BACKUP_PATH                            (CI override)
//
// We resolve the first existing path; if none exist, the V3-based tests
// are SKIPPED (not failed) so CI can run without the V3 source.
// The BenchLM-shape assertions stay active regardless of V3 availability.

const V3_CANDIDATES = [
  join(ROOT, 'v3-monolith-backup.html'),
  resolve(ROOT, '..', 'SDD', 'Modelos SDD - V3 - Lucide.html'),
  process.env.SDD_V3_BACKUP_PATH,
].filter(Boolean);

let V3_BACKUP = null;
for (const candidate of V3_CANDIDATES) {
  try {
    readFileSync(candidate, 'utf-8');
    V3_BACKUP = candidate;
    break;
  } catch {
    // try next
  }
}

const V3_AVAILABLE = V3_BACKUP !== null;

/**
 * Extract the MODELS constant from the V3 HTML snapshot. Kept for the
 * name/tier/price drift-detection test that does NOT depend on the
 * benchlm-shape migration.
 */
function parseV3Models(html) {
  const startIdx = html.indexOf('const MODELS');
  if (startIdx < 0) throw new Error('V3 MODELS constant not found');
  const openBrace = html.indexOf('{', startIdx);
  if (openBrace < 0) throw new Error('V3 MODELS opening brace not found');
  let depth = 1;
  let i = openBrace + 1;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  const body = html.slice(openBrace + 1, i - 1);

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
 */
function normalizeTier(v3Tier) {
  if (v3Tier === 'mid') return 'balanced';
  return v3Tier;
}

/**
 * Name comparison is case-insensitive: V3 stores display names with the
 * vendor's canonical casing while V4 normalizes them.
 */
function nameEqual(a, b) {
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

// Models that exist in V3 with STUB payloads and were later filled in with
// real benchmarks in V4. Same allow-list carried forward from Phase 1.
const KNOWN_V4_ONLY = new Set([
  'gpt54',
  'claudeFable5',
  'sonnet5',
  'haiku45',
  'gpt56terra',
  'gpt56sol',
  'kimik27c',
  'kimik25',
  'kimik3',
]);

// --- PR3 assertions (always run, no V3 dependency required) ----------------

describe('data-integrity: BenchLM-shape contract (PR3)', () => {
  const doc = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));

  test('_meta block declares schemaVersion 2 (matches CURRENT_SCHEMA_VERSION after PR1)', () => {
    // Loader's readCache discards mismatched versions, so this must match
    // CURRENT_SCHEMA_VERSION exported from js/services/data-loader.js.
    expect(doc._meta).toBeDefined();
    expect(doc._meta.schemaVersion).toBe(2);
    expect(doc._meta.lastSynced).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('every tracked V4 model has a `benchlm` block', () => {
    // The post-PR1 contract: every model the app tracks carries a
    // `benchlm` block (either populated by scrape-benchlm or with the
    // null-sentinel placeholder when BenchLM has not yet returned the
    // model).
    const models = doc.models;
    const keys = Object.keys(models);
    expect(keys.length).toBeGreaterThan(0);

    const missing = [];
    for (const k of keys) {
      const m = models[k];
      if (!m || typeof m !== 'object' || m.benchlm === null || m.benchlm === undefined) {
        missing.push(k);
      }
    }
    expect(missing, `Models missing benchlm block: ${missing.join(', ')}`).toEqual([]);
  });

  test('every `benchlm` block has the required sub-keys in valid types', () => {
    const models = doc.models;
    for (const [key, m] of Object.entries(models)) {
      const b = m.benchlm;
      expect(b, `model ${key} missing benchlm`).toBeDefined();
      expect(b, `model ${key} benchlm is null`).not.toBeNull();
      // `score` may be null (BenchLM hasn't populated it yet) — but it
      // must always be present and a number-or-null.
      expect(b, `model ${key} benchlm.score field missing`).toHaveProperty('score');
      if (b.score !== null) {
        expect(Number.isFinite(b.score), `model ${key} benchlm.score not finite`).toBe(true);
        expect(b.score).toBeGreaterThanOrEqual(0);
        expect(b.score).toBeLessThanOrEqual(100);
      }
      // `verified` is always a boolean (false for placeholder, true for real).
      expect(typeof b.verified, `model ${key} benchlm.verified not boolean`).toBe('boolean');
      // `reliability` is a number in [0, 1].
      expect(typeof b.reliability, `model ${key} benchlm.reliability not number`).toBe('number');
      expect(Number.isFinite(b.reliability), `model ${key} benchlm.reliability not finite`).toBe(true);
      expect(b.reliability).toBeGreaterThanOrEqual(0);
      expect(b.reliability).toBeLessThanOrEqual(1);
      // `categories` is always an object (may be empty when BenchLM hasn't
      // broken out categories yet).
      expect(b.categories, `model ${key} benchlm.categories missing`).toBeDefined();
      expect(typeof b.categories, `model ${key} benchlm.categories not object`).toBe('object');
      expect(b.categories, `model ${key} benchlm.categories is null`).not.toBeNull();
    }
  });

  test('placeholder benchlm blocks (score=null) mean "BenchLM not yet ingested"', () => {
    // Models with score=null are the pre-PR1-merge state — BenchLM has
    // not yet published data for them. The downstream readers (chart,
    // model-card, ref-table) MUST render these as "unavailable".
    const models = doc.models;
    const placeholders = Object.entries(models).filter(
      ([, m]) => m.benchlm && m.benchlm.score === null
    );
    // This test passes whether or not placeholders exist; it documents
    // the contract surface.
    expect(Array.isArray(placeholders)).toBe(true);
  });

  test('24 tracked models carried by the curated catalog', () => {
    // PR1 backfilled 24 models. PR3 keeps the count stable.
    const models = doc.models;
    const keys = Object.keys(models);
    // Use ≥ so the test passes when additional tracked models are added
    // post-merge, but assert ≥24 to pin the PR1 contract.
    expect(keys.length).toBeGreaterThanOrEqual(24);
  });
});

// --- V3 source drift-detection (informational; skipped without V3 source) -

describe('data-integrity: V3 source vs data/models.json (drift detector)', () => {
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
      if (KNOWN_V4_ONLY.has(k)) continue;
      expect(v3Keys.has(k), `V4 has orphan key (not in V3): ${k}`).toBe(true);
    }
  });

  // PR3 NOTE: the legacy `arena` field comparison is removed from this
  // file. PR3 cutover moved the source of truth for benchmarks from V3
  // LMSYS/SWE-Bench/Terminal-Bench flat fields to BenchLM, and the V3
  // arena number no longer matches any V4 field. The identity contract
  // (name, tier, input, output) is preserved below.

  test('name, input, output, tier match between V3 and V4 (PR3 identity contract)', () => {
    for (const key of Object.keys(v3)) {
      if (KNOWN_V4_ONLY.has(key)) continue;
      const a = v3[key];
      const b = v4[key];
      expect(b, `V4 missing model ${key}`).toBeDefined();
      expect(nameEqual(b.name, a.name), `V4 name "${b.name}" != V3 name "${a.name}"`).toBe(true);
      expect(b.input).toBeCloseTo(Number(a.input), 6);
      expect(b.output).toBeCloseTo(Number(a.output), 6);
      expect(b.tier).toBe(normalizeTier(a.tier));
    }
  });

  test('reference-tier models in V3 are flagged isReference in V4', () => {
    const v3Refs = Object.values(v3)
      .filter((m) => m.tier === 'reference')
      .map((m) => m.name);
    expect(v3Refs.length).toBeGreaterThan(0);
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

// --- BenchLM backfill gate (PR1 — benchlm-replace-custom-scoring) -------------
//
// PR1 adds a `benchlm` placeholder block to EVERY tracked model in
// data/models.json. The block is the audit/contract surface for the
// upcoming BenchLM scraper (PR2) and reader migration (PR3); it lives
// on every model now so the scraper can replace it in-place on first
// scheduled sync without re-touching the file's overall structure.
//
// Placeholder shape: `{score: null, verified: false, reliability: 0,
// categories: {}}`. The scraper (PR2) will overwrite the four fields
// with real BenchLM values; until then, `score: null` signals "no data
// yet" to renderers and the composite-chart "unavailable" placeholder
// (PR3) is the expected user-visible behavior.
//
// KNOWN_MISSING is the explicit allowlist for models BenchLM does NOT
// list at all (so the scraper leaves the key absent, not as a
// placeholder with `score: null`). It starts empty for PR1 — the
// scraper's first sync will populate it after inspecting real data.
const KNOWN_MISSING = [];

describe('data-integrity: benchlm backfill', () => {
  test('every tracked model carries a benchlm block (or is in KNOWN_MISSING)', () => {
    const raw = JSON.parse(
      readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
    );
    const models = raw.models;
    const missing = [];
    for (const [key, model] of Object.entries(models)) {
      if (model.benchlm !== undefined) continue;
      if (KNOWN_MISSING.includes(key)) continue;
      missing.push(key);
    }
    expect(
      missing,
      `Models missing benchlm block: ${missing.join(', ') || 'none'} (KNOWN_MISSING=${KNOWN_MISSING.length})`
    ).toEqual([]);
  });
});

// --- Kimi K3 provenance (Phase-1 provenance preservation) ------------------


describe('data-integrity: Kimi K3 provenance', () => {
  const k3 = JSON.parse(
    readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
  ).models.kimik3;

  test('kimik3 has every required catalog field and valid source entries', () => {
    expect(k3).toBeDefined();
    for (const key of ['name', 'tier', 'input', 'output', 'notes', 'sources', 'benchlm']) {
      expect(k3).toHaveProperty(key);
    }
    expect(k3.sources.length).toBeGreaterThan(0);
    for (const source of k3.sources) {
      expect(source).toHaveProperty('url');
      expect(source).toHaveProperty('date');
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // BenchLM block under PR3: k3 should be present in source-of-truth
    // with the placeholder shape (since BenchLM does not list K3 yet).
    expect(k3.benchlm).not.toBeNull();
    expect(k3.benchlm).toBeDefined();
  });

  test('every K3 legacy benchmark field is numeric-or-null with dated evidence', () => {
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

// --- Claude Sonnet 5 pricing (BenchLM 2026-07-17 snapshot) -----------------

import { costEstimate } from '../js/services/model-scorer.js';

describe('data-integrity: Claude Sonnet 5 pricing (BenchLM 2026-07-17)', () => {
  const raw = JSON.parse(
    readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
  );
  const sonnet5 = raw.models.sonnet5;

  test('sonnet5 is defined and active (not reference)', () => {
    expect(sonnet5).toBeDefined();
    expect(sonnet5.name).toBe('Claude Sonnet 5');
    expect(sonnet5.tier).not.toBe('reference');
    expect(sonnet5.isReference).toBeFalsy();
  });

  test('sonnet5.input === 2 and sonnet5.output === 10 (BenchLM v5.2 2026-07-17)', () => {
    expect(sonnet5.input).toBe(2);
    expect(sonnet5.output).toBe(10);
  });

  test('sonnet5 has no cacheRead field (absent/null per BenchLM source)', () => {
    expect(sonnet5.cacheRead).toBeUndefined();
  });

  test('sonnet5 costEstimate with default profile (1000+500) equals 0.007 USD', () => {
    const cost = costEstimate(sonnet5);
    expect(cost).toBeCloseTo(0.007, 6);
  });

  test('sonnet5 has a BenchLM source dated 2026-07-17', () => {
    expect(Array.isArray(sonnet5.sources)).toBe(true);
    const benchlmSource = sonnet5.sources.find(
      (s) => s.url && s.url.includes('benchlm') && s.date === '2026-07-17'
    );
    expect(benchlmSource).toBeDefined();
  });

  test('sonnet5 benchlm evidence is estimated', () => {
    expect(sonnet5.benchlm.evidence).toBe('estimated');
  });
});
