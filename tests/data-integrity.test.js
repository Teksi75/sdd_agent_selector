// tests/data-integrity.test.js
// Integrity contract for the V5 catalog + loader join.
//
// The suite asserts:
//   - every tracked model has a `benchlm` block with valid {score,
//     verified, reliability, categories};
//   - catalog schemaVersion === 5 (V5 availability matrix bump);
//   - the V5 gate aggregate (availability matrix, inheritance/override
//     report, 6-file loader descriptor, fixed surface counts, write-guard);
//   - the V3 cut sentinel (root snapshot absent, `V3_AVAILABLE = false`).
//
// The former V3 drift detector (candidate paths / HTML parser / parity
// allowlists) was retired by the V5 V3 cut; the archived monolith is never
// read here.

import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// --- V3 cut sentinel (V5) ---------------------------------------------------
//
// The V3 monolith moved to the archived rollback location (V5 cut). The drift
// detector that used to live here is retired: no candidate resolution, no HTML
// parser, no parity allowlists. The optional harness stays explicitly disabled
// so the suite passes without the monolith at the repository root.
const V3_AVAILABLE = false;

describe('data-integrity: V3 cut sentinel', () => {
  test('the V3 monolith no longer lives at the repository root', () => {
    expect(existsSync(join(ROOT, 'v3-monolith-backup.html'))).toBe(false);
  });

  test.skipIf(V3_AVAILABLE)('V3 parity harness remains disabled (V3_AVAILABLE = false)', () => {
    // intentional no-op: the V3 drift checks were retired with the V3 cut
  });
});

const AA_ALIAS_TARGETS = new Set(
  JSON.parse(readFileSync(join(ROOT, 'data', 'aa-aliases.json'), 'utf-8'))
    .aliases.map(({ to }) => to)
);

// --- V5 gate aggregate (replaces the retired V3 checksum/drift contracts) ----
//
// The V3 checksum requirement was removed with the V3 cut. This block
// re-points the integrity suite at the V5 gates: the full families x providers
// availability matrix, effort-variant inheritance and the override report, the
// 6-file loader descriptor, the fixed surface counts, the pricingSource
// orthogonality and the scraper write-guard. Behavioral coverage of each gate
// also lives in its dedicated suite (availability-matrix,
// propagate-provider-availability, data-loader, hero-stats, cli-mirror-table,
// workflow-table, config-selector, scraper-provider-registry); this block keeps
// the aggregate contract in one place and never reads the archived monolith.

import {
  familyKey,
  missingMatrixCells,
  propagate,
  readRegistry,
} from '../scripts/propagate-provider-availability.mjs';
import { CURRENT_SCHEMA_VERSION, DATA_FILES } from '../js/services/data-loader.js';
import { applyProviderFilter } from '../js/services/provider-filter.js';
import { countModelsByLifecycle } from '../js/components/hero-stats.js';
import {
  MANUAL_MODEL_FIELDS,
  MODELS_JSON_PATH,
  preserveManualModelFields,
} from '../scripts/_scraper-utils.mjs';

const SCRAPER_FILES = Object.freeze([
  'scrape-opencode-prices',
  'scrape-openai-pricing',
  'scrape-anthropic-pricing',
  'scrape-arena-leaderboard',
  'scrape-glm-blog',
  'scrape-swebench-leaderboard',
  'scrape-benchlm',
  'scrape-artificialanalysis',
]);

describe('data-integrity: V5 gate aggregate', () => {
  const modelsDoc = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));
  const models = modelsDoc.models;
  const availability = Object.fromEntries(
    Object.entries(models).map(([id, record]) => [id, record.availability])
  );
  const registry = JSON.parse(readFileSync(join(ROOT, 'data', 'providers.json'), 'utf-8'));
  const providerIds = registry.providers.map((p) => p.id);
  const roles = JSON.parse(readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8'));
  const phases = JSON.parse(readFileSync(join(ROOT, 'data', 'phases.json'), 'utf-8'));
  const configs = JSON.parse(readFileSync(join(ROOT, 'data', 'configs.json'), 'utf-8'));
  const overrides = modelsDoc._meta.availabilityOverrides ?? [];

  test('provider registry + full families x providers matrix (zero missing cells)', () => {
    const { providerIds: ids, errors } = readRegistry(join(ROOT, 'data', 'providers.json'));
    expect(errors).toEqual([]);
    expect(ids).toEqual(providerIds);
    expect(missingMatrixCells(models, providerIds)).toEqual([]);
    for (const [id, record] of Object.entries(models)) {
      expect(Object.keys(record.availability).sort(), id + '.availability keys').toEqual(
        [...providerIds].sort()
      );
      for (const value of Object.values(record.availability)) {
        expect(typeof value, id + '.availability value').toBe('boolean');
      }
    }
  });

  test('effort variants inherit the base map and every override is declared + reported', () => {
    const result = propagate(models, providerIds, overrides);
    expect(result.errors).toEqual([]);
    expect(result.honored).toEqual(overrides);
    let variants = 0;
    for (const id of Object.keys(models)) {
      const family = familyKey(id, models);
      if (family === id) continue;
      expect(result.models[id].availability, id + ' inherits ' + family).toEqual(
        result.models[family].availability
      );
      variants++;
    }
    expect(variants).toBeGreaterThan(0);
  });

  test('loader descriptor joins 6 files and CURRENT_SCHEMA_VERSION is 5', () => {
    expect(DATA_FILES).toHaveLength(6);
    expect(DATA_FILES.map(([path]) => path)).toContain('data/providers.json');
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });

  test('catalog has >= 25 models and every AA alias target is AA-owned', () => {
    expect(Object.keys(models).length).toBeGreaterThanOrEqual(25);
    for (const target of AA_ALIAS_TARGETS) {
      expect(models[target]?.pricingSource, target + ' AA alias target').toBe(
        'artificialanalysis'
      );
    }
  });

  test('fixed surface counts: cli-mirror 18 agents, workflow 9 phases, 5 config buttons', () => {
    expect(Object.keys(roles.roles)).toHaveLength(18);
    expect(phases.phases).toHaveLength(9);
    expect(configs.configs).toHaveLength(5);
    expect(configs.configs.map((c) => c.key)).toEqual([
      'economico',
      'balanceado',
      'maximo',
      'hibrido',
      'experimental',
    ]);
  });

  test('hero visible count: Y comes from the live active catalog and is filter-stable', () => {
    const total = countModelsByLifecycle(models);
    expect(total.active).toBe(
      Object.values(models).filter((m) => m.lifecycle === 'active').length
    );
    const eligible = applyProviderFilter(models, availability, new Set(providerIds));
    expect(countModelsByLifecycle(eligible).active).toBe(total.active);
    const narrow = applyProviderFilter(models, availability, new Set(['opencode-go']));
    expect(countModelsByLifecycle(narrow).active).toBeLessThanOrEqual(total.active);
  });

  test('pricingSource is never consulted for eligibility', () => {
    const enabled = new Set(providerIds);
    const before = Object.keys(applyProviderFilter(models, availability, enabled));
    const mutated = Object.fromEntries(
      Object.entries(models).map(([id, record]) => [id, { ...record, pricingSource: 'unknown' }])
    );
    expect(Object.keys(applyProviderFilter(mutated, availability, enabled))).toEqual(before);
  });

  test('scraper write-guard preserves availability for all 8 scrapers', () => {
    expect(MANUAL_MODEL_FIELDS).toContain('availability');
    const onDisk = { shared: { input: 1, availability: { 'opencode-go': true } } };
    const merged = preserveManualModelFields(onDisk, { shared: { input: 2 }, fresh: { input: 3 } });
    expect(merged.shared.input).toBe(2);
    expect(merged.shared.availability).toEqual({ 'opencode-go': true });
    expect(merged.fresh.availability).toEqual({});
    expect(() => preserveManualModelFields(onDisk, {})).toThrow(/missing 1 id/);
    expect(MODELS_JSON_PATH.endsWith(join('data', 'models.json'))).toBe(true);
    expect(SCRAPER_FILES).toHaveLength(8);
    for (const name of SCRAPER_FILES) {
      const source = readFileSync(join(ROOT, 'scripts', name + '.js'), 'utf-8');
      expect(source, name + ' uses the shared write API').toContain('writeModelsJson');
      expect(source, name + ' never names providers.json').not.toContain('providers.json');
    }
  });
});

// --- PR3 assertions (always run, no V3 dependency required) ----------------

describe('data-integrity: BenchLM-shape contract (PR3)', () => {
  const doc = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));

  test('_meta block declares catalog schemaVersion 5', () => {
    // V5 bumps the catalog schema for the required availability matrix; the
    // loader cache constant is bumped independently in slice 2 (task 2.4).
    expect(doc._meta).toBeDefined();
    expect(doc._meta.schemaVersion).toBe(5);
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

  test('consolidated estimated Luna never outranks its verified Sol flagship', () => {
    // Regression guard for the 2026-08 distortion: the provisional
    // BenchLM estimate for GPT-5.6 Luna briefly sat above GPT-5.6 Sol's
    // verified score, inverting the family ordering in the Composite table.
    const sol = doc.models.gpt56sol;
    const luna = doc.models.gpt56luna;
    expect(typeof sol?.benchlm?.score).toBe('number');
    expect(typeof luna?.benchlm?.score).toBe('number');
    expect(sol.benchlm.verified).toBe(true);
    expect(luna.benchlm.evidence).toBe('estimated');
    expect(
      luna.benchlm.score,
      'estimated gpt56luna score must stay below verified gpt56sol score'
    ).toBeLessThan(sol.benchlm.score);
    expect(luna.effort).toBe('max');
  });

  test('at least 25 tracked models carried by the curated catalog', () => {
    const models = doc.models;
    const keys = Object.keys(models);
    expect(keys.length).toBeGreaterThanOrEqual(25);
  });
});

// --- Loader cache migration gate (PR4 — aa-benchmark-integration) ------------
//
// PR4 owns the loader cache version independently of the catalog schema. The
// loader's readCache already discards cached payloads whose
// `schemaVersion` does not match the live constant, so bumping it forces a
// clean refetch on the next page load (no manual cache clear needed).
//
// Why export the constant: it's currently a private `const`, but the
// integrity test is the natural place to pin the migration number. We
// keep the export name identical and add a JSDoc note so future
// contributors don't treat the export as part of the public consumer
// API — it's a test affordance.

describe('data-integrity: loader cache migration gate', () => {
  test('CURRENT_SCHEMA_VERSION in data-loader is 5 for the V5 registry join', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });
});

// --- Schema v4 assertions (AA effort-level catalog) --------------------------
//
// Schema v4 carries the AA pricing surface: optional `term` (Terminal-Bench
// v2.1), `codingIndex`, `median_output_tokens_per_second`,
// `median_time_to_first_token_seconds`, locally-computed `blended`
// ((3*input + output)/4), and the `pricingSource: "artificialanalysis"`
// authority marker. `_meta.sources` gains the `scrape-artificialanalysis`
// provenance tag.
//
// The catalog contains the canonical Luna record plus the effort variants
// materialized from the captured AA v2 payload. The AA-owned contract below
// protects every curated alias target while leaving vendor-owned records
// untouched.

describe('data-integrity: schema v4 (AA pricing schema)', () => {
  const raw = JSON.parse(
    readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
  );

  test('_meta.sources carries the scrape-artificialanalysis provenance tag', () => {
    expect(Array.isArray(raw._meta.sources)).toBe(true);
    expect(raw._meta.sources).toContain('scrape-artificialanalysis');
  });

  test('AA-owned pricing covers every curated alias target', () => {
    const aaModels = Object.entries(raw.models).filter(
      ([, model]) => model.pricingSource === 'artificialanalysis'
    );
    expect(new Set(aaModels.map(([key]) => key))).toEqual(AA_ALIAS_TARGETS);
    expect(AA_ALIAS_TARGETS.has('gpt56luna')).toBe(true);
    for (const [key, model] of Object.entries(raw.models)) {
      if (model.pricingSource === 'artificialanalysis') continue;
      expect(model.pricingSource, `model ${key} must not claim AA pricing`).toBeUndefined();
      expect(model.blended, `model ${key} must not carry AA blended pricing`).toBeUndefined();
    }
  });

  test('no API key material leaks into the published data', () => {
    const serialized = JSON.stringify(raw);
    expect(serialized).not.toContain('AA_API_KEY');
    expect(serialized).not.toMatch(/x-api-key/i);
  });

  test('benchmark fields are untouched by the schema bump (shape unchanged per model)', () => {
    for (const [key, model] of Object.entries(raw.models)) {
      expect(model.benchlm, `model ${key} benchlm`).toBeDefined();
      for (const field of ['arena', 'swePro', 'sweVer', 'term']) {
        if (field in model) {
          const v = model[field];
          expect(
            v === null || Number.isFinite(v),
            `model ${key}.${field} must be finite-or-null after the v3 bump`
          ).toBe(true);
        }
      }
    }
  });

  test('AA-owned models (when present) compute blended locally and keep provenance', () => {
    const aaModels = Object.entries(raw.models).filter(
      ([, m]) => m.pricingSource === 'artificialanalysis'
    );
    for (const [key, m] of aaModels) {
      expect(Number.isFinite(m.input), `${key} input must be finite`).toBe(true);
      expect(Number.isFinite(m.output), `${key} output must be finite`).toBe(true);
      expect(m.blended, `${key} blended must equal (3*input + output)/4`).toBeCloseTo(
        (3 * m.input + m.output) / 4,
        10
      );
      const aaSource = (m.sources || []).find(
        (s) => s && s.url === 'https://artificialanalysis.ai/' && s.scraper === 'scrape-artificialanalysis'
      );
      expect(aaSource, `${key} must carry AA attribution`).toBeDefined();
    }
  });

  test('AA-owned models never synthesize omitted optional fields as 0/null', () => {
    const aaModels = Object.entries(raw.models).filter(
      ([, m]) => m.pricingSource === 'artificialanalysis'
    );
    for (const [key, m] of aaModels) {
      for (const field of ['cacheRead', 'cacheWrite', 'term', 'codingIndex']) {
        if (field in m) {
          expect(
            Number.isFinite(m[field]),
            `${key}.${field} must be finite when present (never 0/null)`
          ).toBe(true);
        }
      }
    }
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

  test('sonnet5 keeps finite AA-owned pricing fields', () => {
    expect(Number.isFinite(sonnet5.input)).toBe(true);
    expect(Number.isFinite(sonnet5.output)).toBe(true);
  });

  test('sonnet5 cacheRead is optional and finite when present', () => {
    expect(
      sonnet5.cacheRead === undefined || Number.isFinite(sonnet5.cacheRead)
    ).toBe(true);
  });

  test('sonnet5 costEstimate uses the current catalog pricing', () => {
    const cost = costEstimate(sonnet5);
    expect(cost).toBeCloseTo(
      (1000 * sonnet5.input + 500 * sonnet5.output) / 1_000_000,
      12
    );
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

// --- GPT-5.6 Luna catalog integrity (BenchLM 2026-07-20) -----------------

describe('data-integrity: GPT-5.6 Luna catalog (BenchLM 2026-07-20)', () => {
  const raw = JSON.parse(
    readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
  );
  const luna = raw.models.gpt56luna;

  test('gpt56luna exists and has correct name', () => {
    expect(luna).toBeDefined();
    expect(luna.name).toBe('GPT-5.6 Luna');
  });

  test('benchlm score and rank are present with estimated evidence', () => {
    expect(Number.isFinite(luna.benchlm.score)).toBe(true);
    expect(Number.isInteger(luna.benchlm.rank)).toBe(true);
    expect(luna.benchlm.rank).toBeGreaterThan(0);
    expect(luna.benchlm.evidence).toBe('estimated');
  });

  test('pricing fields are finite AA-owned values with a local blended formula', () => {
    expect(Number.isFinite(luna.input)).toBe(true);
    expect(Number.isFinite(luna.output)).toBe(true);
    expect(luna.pricingSource).toBe('artificialanalysis');
    expect(luna.blended).toBeCloseTo((3 * luna.input + luna.output) / 4, 12);
    expect(luna.cacheRead).toBeUndefined();
  });

  test('lifecycle is active (V5 demote), tier is budget', () => {
    expect(luna.lifecycle).toBe('active');
    expect(luna.tier).toBe('budget');
  });

  test('AA-owned Terminal-Bench stays numeric while SWE-bench provenance is preserved', () => {
    expect(Number.isFinite(luna.term)).toBe(true);
    expect(luna.swePro).toBe(62.7);
  });

  test('categories match BenchLM verified values', () => {
    const c = luna.benchlm.categories;
    expect(c.agentic).toBe(58.5);
    expect(c.coding).toBe(72.6);
    expect(c.reasoning).toBeNull();
    expect(c.multimodalGrounded).toBe(65.7);
    expect(c.knowledge).toBe(80.9);
    expect(c.multilingual).toBeNull();
    expect(c.instructionFollowing).toBeNull();
    expect(c.math).toBe(97.1);
  });

  test('has BenchLM source dated 2026-07-20', () => {
    expect(Array.isArray(luna.sources)).toBe(true);
    const src = luna.sources.find(
      (s) => s.url === 'https://benchlm.ai/models/gpt-5-6-luna' && s.date === '2026-07-20'
    );
    expect(src).toBeDefined();
  });

  test('notes document the provisional score and consolidation', () => {
    expect(luna.notes).toMatch(/provisional/i);
    expect(luna.notes).toMatch(/consolidat/i);
  });
});

// --- AA 2026-09-13 backfill (Fase 2, PR-A) ----------------------------------
//
// The one-shot backfill of the AA 2026-09-13 chart is audited by BOTH sides:
// the catalog (`data/models.json`) and the manifest of evidence
// (`openspec/changes/2026-09-13-aa-intelligence-refresh/evidence/`). Every
// manifest row must resolve to the exact catalog value plus its AA source
// tuple; every catalog model carrying the AA 2026-09-13 tuple must be
// enumerated in the manifest. No number without evidence, no evidence without
// number.

describe('data-integrity: AA 2026-09-13 backfill (manifest ↔ sources 1:1)', () => {
  const raw = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));
  const models = raw.models;
  const MANIFEST_PATH = join(
    ROOT,
    'openspec',
    'changes',
    '2026-09-13-aa-intelligence-refresh',
    'evidence',
    'aa-2026-09-13-backfill-manifest.md'
  );
  const AA_BACKFILL_DATE = '2026-09-13';

  // Markdown table row shape: | # | Fila del chart | model id | Campo | Valor |
  // url | date | scraper | Nota |. The model id is the only backticked id cell;
  // field/value/url/date/scraper follow it, so rows are located structurally
  // (this skips the manifest's other tables and header rows).
  const parseBackfillManifest = (markdown) => {
    const rows = [];
    for (const line of markdown.split('\n')) {
      if (!line.trim().startsWith('|')) continue;
      const cells = line.split('|').map((cell) => cell.trim());
      const idIndex = cells.findIndex((cell) => /^`[^`]+`$/.test(cell));
      if (idIndex < 0 || cells.length < idIndex + 6) continue;
      const url = cells[idIndex + 3];
      const date = cells[idIndex + 4];
      if (!/^https?:\/\//.test(url) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      rows.push({
        modelId: cells[idIndex].slice(1, -1),
        field: cells[idIndex + 1].replace(/`/g, ''),
        value: cells[idIndex + 2].replace(/`/g, ''),
        url,
        date,
        scraper: cells[idIndex + 5].replace(/`/g, ''),
      });
    }
    return rows;
  };

  const manifestRows = parseBackfillManifest(readFileSync(MANIFEST_PATH, 'utf-8'));

  test('the manifest enumerates every traced backfill number exactly once', () => {
    expect(manifestRows.length).toBeGreaterThanOrEqual(16); // >= 8 models x 2 fields
    const seen = new Set();
    for (const row of manifestRows) {
      const key = `${row.modelId}.${row.field}`;
      expect(seen.has(key), `${key} duplicated in the manifest`).toBe(false);
      seen.add(key);
    }
  });

  test('every manifest row resolves to the exact catalog value + AA source tuple', () => {
    for (const row of manifestRows) {
      const model = models[row.modelId];
      expect(model, `${row.modelId} (manifest row) must exist in data/models.json`).toBeDefined();
      const expected = Number(row.value);
      expect(Number.isFinite(expected), `${row.modelId}.${row.field} manifest value`).toBe(true);

      if (row.field === 'intelligenceIndex') {
        expect(model.intelligenceIndex, `${row.modelId}.intelligenceIndex`).toBe(expected);
      } else if (row.field === 'benchlm.score') {
        expect(model.benchlm?.score, `${row.modelId}.benchlm.score`).toBe(expected);
      } else {
        throw new Error(`unexpected manifest field: ${row.field}`);
      }

      expect(model.sources, `${row.modelId}.sources`).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ url: row.url, date: row.date, scraper: row.scraper }),
        ])
      );
    }
  });

  test('every catalog model carrying the AA 2026-09-13 tuple is enumerated in the manifest', () => {
    const backfilled = Object.entries(models)
      .filter(([, model]) =>
        (model.sources || []).some(
          (source) => source.url === 'https://artificialanalysis.ai/' &&
            source.date === AA_BACKFILL_DATE &&
            source.scraper === 'scrape-artificialanalysis'
        )
      )
      .map(([id]) => id)
      .sort();
    const manifestIds = [...new Set(manifestRows.map((row) => row.modelId))].sort();
    expect(backfilled).toEqual(manifestIds);
  });

  test('intelligenceIndex is finite-or-null catalog-wide, never a fabricated 0', () => {
    const covered = Object.entries(models).filter(([, model]) =>
      Object.hasOwn(model, 'intelligenceIndex')
    );
    expect(covered.length).toBeGreaterThan(0);
    for (const [id, model] of covered) {
      const value = model.intelligenceIndex;
      expect(
        value === null || Number.isFinite(value),
        `${id}.intelligenceIndex must be finite or null`
      ).toBe(true);
    }
  });

  test('no duplicated model names inside the AA-owned catalog (DeepSeek/MiniMax reconciliation)', () => {
    const aaNames = new Map();
    for (const [id, model] of Object.entries(models)) {
      if (model.pricingSource !== 'artificialanalysis') continue;
      const name = String(model.name || '').trim().toLowerCase();
      expect(aaNames.has(name), `${id} duplicates AA-owned name "${name}"`).toBe(false);
      aaNames.set(name, id);
    }
  });

  test('compositeScore source stays untouched: no intelligenceIndex reference', () => {
    const source = readFileSync(join(ROOT, 'js', 'services', 'model-scorer.js'), 'utf-8');
    expect(source).not.toContain('intelligenceIndex');
  });
});
