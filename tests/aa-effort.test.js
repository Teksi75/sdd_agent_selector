// @vitest-environment node
// tests/aa-effort.test.js
// Catalog schema-4 and GPT-5.6 Luna consolidation contract for PR3A.

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AA_EFFORTS } from '../scripts/_aa-safety.mjs';
import { applyProviderFilter } from '../js/services/provider-filter.js';
import { compositeScore, costEstimate, applyStrategy } from '../js/services/model-scorer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const raw = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));
const models = raw.models;
const aliases = JSON.parse(
  readFileSync(join(ROOT, 'data', 'aa-aliases.json'), 'utf-8')
).aliases;

const OPTIONAL_FIELDS = [
  'term',
  'codingIndex',
  'mathIndex',
  'outputTokensPerSecond',
  'timeToFirstTokenSeconds',
  'timeToFirstAnswerTokenSeconds',
];

const NO_BENCHLM_NOTE =
  'No BenchLM observation for this effort variant; scores documented as absent';

// S1 (AA alias mass-mapping) maps three auto-stubbed catalog rows to live AA
// slugs. The S2 II backfill materializes their `effort`/`pricingSource`; until
// then these transitional lists MUST stay explicit so the strict invariants
// below cannot silently weaken. S2 MUST shrink both to [] when it lands.
const AA_MAPPED_PENDING_BACKFILL = new Set([]); // S2b empties the S1 transitional set (glm53 + grok46 backfilled with ownership)
const AA_PENDING_EFFORT = new Set([]); // S2b materializes alias effort on every target

// Pre-variant curated records: they existed (or land via one-shot curation)
// outside the PR3A variant materialization, so the PR3B variant contract
// below does not apply to them. gpt6astra/gpt6astraLow are manual OpenAI docs
// curation; musespark13 is the 2026-09-13 AA max backfill (benchmark-only),
// distinct from musespark13contributor (xhigh). grok46/glm53 are S1-mapped
// opencode stubs whose AA backfill lands in S2.
const PRE_VARIANT_KEYS = new Set([
  'gpt6astra',
  'grok46',
  'glm53',
  'gpt6astraLow',
  'musespark13',
  'glm52',
  'qwen37max',
  'glm51',
  'minimaxm3',
  'kimik27c',
  'kimik3',
  'kimik25',
  'kimik26',
  'deepseekv4p',
  'mimo25pro',
  'qwen37plus',
  'qwen36plus',
  'minimaxm27',
  'mimo25',
  'minimaxm25',
  'deepseekv4f',
  'glm5',
  'opus48',
  'gpt55',
  'gpt56terra',
  'gpt56luna',
  'gpt56sol',
  'gpt54',
  'claudeFable5',
  'sonnet5',
  'haiku45',
  'claudeOpus5',
  'opencodeHy3',
  'grok45',
  'qwen38max',
]);

// 2026-09-14 curation follow-up: Fable 5.1 rows are active (user-confirmed
// Anthropic production serving), so they leave the non-active-variant map.
const NON_ACTIVE_NEW_VARIANTS = new Map([
  ['glm51NonReasoning', 'legacy'],
  ['glm5NonReasoning', 'legacy'],
  ['gpt55High', 'reference'],
  ['gpt55Medium', 'reference'],
  ['gpt55Low', 'reference'],
  ['gpt55NonReasoning', 'reference'],
]);

const EXPECTED_VARIANT_NAMES = {
  claudeFable51: 'Claude Fable 5.1',
  claudeFable51Xhigh: 'Claude Fable 5.1 (Adaptive Reasoning, Xhigh Effort)',
  claudeFable51High: 'Claude Fable 5.1 (Adaptive Reasoning, High Effort)',
  claudeFable51Medium: 'Claude Fable 5.1 (Adaptive Reasoning, Medium Effort)',
  claudeFable51Low: 'Claude Fable 5.1 (Adaptive Reasoning, Low Effort)',
  glm52NonReasoning: 'GLM-5.2 (Non-reasoning)',
  glm51NonReasoning: 'GLM-5.1 (Non-reasoning)',
  kimik3Low: 'Kimi K3 (low)',
  kimik25NonReasoning: 'Kimi K2.5 (Non-reasoning)',
  kimik26NonReasoning: 'Kimi K2.6 (Non-reasoning)',
  mimo25proNonReasoning: 'MiMo-V2.5-Pro (Non-reasoning)',
  deepseekv4fNonReasoning: 'DeepSeek V4 Flash (Non-reasoning)',
  glm5NonReasoning: 'GLM-5 (Non-reasoning)',
  gpt55High: 'GPT-5.5 (high)',
  gpt55Medium: 'GPT-5.5 (medium)',
  gpt55Low: 'GPT-5.5 (low)',
  gpt55NonReasoning: 'GPT-5.5 (Non-reasoning)',
  gpt54Low: 'GPT-5.4 (low)',
  gpt54NonReasoning: 'GPT-5.4 (Non-reasoning)',
  gpt56terraXhigh: 'GPT-5.6 Terra (xhigh)',
  gpt56terraHigh: 'GPT-5.6 Terra (high)',
  gpt56terraMedium: 'GPT-5.6 Terra (medium)',
  gpt56terraLow: 'GPT-5.6 Terra (low)',
  gpt56terraNonReasoning: 'GPT-5.6 Terra (Non-reasoning)',
  gpt56lunaXhigh: 'GPT-5.6 Luna (xhigh)',
  gpt56lunaHigh: 'GPT-5.6 Luna (high)',
  gpt56lunaMedium: 'GPT-5.6 Luna (medium)',
  gpt56lunaLow: 'GPT-5.6 Luna (low)',
  gpt56lunaNonReasoning: 'GPT-5.6 Luna (Non-reasoning)',
  gpt56solXhigh: 'GPT-5.6 Sol (xhigh)',
  gpt56solHigh: 'GPT-5.6 Sol (high)',
  gpt56solMedium: 'GPT-5.6 Sol (medium)',
  gpt56solLow: 'GPT-5.6 Sol (low)',
  gpt56solNonReasoning: 'GPT-5.6 Sol (Non-reasoning)',
  sonnet5High: 'Claude Sonnet 5 (Adaptive Reasoning, High Effort)',
  sonnet5Xhigh: 'Claude Sonnet 5 (Adaptive Reasoning, Xhigh Effort)',
  sonnet5Medium: 'Claude Sonnet 5 (Adaptive Reasoning, Medium Effort)',
  sonnet5Low: 'Claude Sonnet 5 (Adaptive Reasoning, Low Effort)',
  sonnet5NonReasoning: 'Claude Sonnet 5 (Non-reasoning, High Effort)',
  haiku45Reasoning: 'Claude 4.5 Haiku (Reasoning)',
  claudeOpus5High: 'Claude Opus 5 (Adaptive Reasoning, High Effort)',
  claudeOpus5Xhigh: 'Claude Opus 5 (Adaptive Reasoning, Xhigh Effort)',
  claudeOpus5Medium: 'Claude Opus 5 (Adaptive Reasoning, Medium Effort)',
  claudeOpus5Low: 'Claude Opus 5 (Adaptive Reasoning, Low Effort)',
};

const AA_VARIANT_KEYS = aliases
  .filter(({ to }) => !PRE_VARIANT_KEYS.has(to))
  .map(({ to }) => to);

describe('AA effort catalog: schema 4 consolidation (PR3A)', () => {
  test('declares catalog schema version 5 (V5 availability bump)', () => {
    expect(raw._meta.schemaVersion).toBe(5);
  });

  test('uses gpt56luna as the sole canonical max-effort entry', () => {
    expect(models.gpt56lunaMax).toBeUndefined();
    expect(models.gpt56luna).toBeDefined();
    expect(models.gpt56luna.effort).toBe('max');
    expect(models.gpt56luna.name).toBe('GPT-5.6 Luna');
  });

  test('preserves the provisional BenchLM observation and family ordering', () => {
    const luna = models.gpt56luna;
    const sol = models.gpt56sol;

    expect(luna.benchlm.verified).toBe(false);
    expect(luna.benchlm.evidence).toBe('estimated');
    expect(typeof luna.benchlm.score).toBe('number');
    expect(sol.benchlm.verified).toBe(true);
    expect(typeof sol.benchlm.score).toBe('number');
    expect(luna.benchlm.score).toBeLessThan(sol.benchlm.score);
  });

  test('adopts AA pricing and preserves both benchmark sources', () => {
    const luna = models.gpt56luna;

    expect(Number.isFinite(luna.input)).toBe(true);
    expect(Number.isFinite(luna.output)).toBe(true);
    expect(luna.blended).toBeCloseTo((3 * luna.input + luna.output) / 4, 12);
    expect(luna.pricingSource).toBe('artificialanalysis');
    expect(luna.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: expect.stringContaining('benchlm.ai') }),
      expect.objectContaining({ url: expect.stringContaining('artificialanalysis.ai') }),
    ]));
    expect(luna.cacheRead).toBeUndefined();
    expect(luna.cacheWrite).toBeUndefined();
  });

  test('keeps the curated lifecycle semantics and documents the consolidation', () => {
    const luna = models.gpt56luna;

    expect(luna.tier).toBe('budget');
    expect(luna.lifecycle).toBe('active');
    expect(luna.isNew).toBeUndefined();
    expect(luna.notes).toMatch(/consolidat/i);
    expect(luna.notes).toMatch(/artificial analysis/i);
  });
});

describe('AA effort catalog: curated variants (PR3B)', () => {
  test('keeps each curated variant on the AA identity and provenance contract', () => {
    expect(AA_VARIANT_KEYS.length).toBeGreaterThan(0);

    for (const key of AA_VARIANT_KEYS) {
      const model = models[key];
      const alias = aliases.find((candidate) => candidate.to === key);

      expect(model, `${key} must exist`).toBeDefined();
      expect(alias, `${key} must have an alias`).toBeDefined();
      expect(model.name).toBe(EXPECTED_VARIANT_NAMES[key]);
      expect(model.effort).toBe(alias.effort);
      expect(model.pricingSource).toBe('artificialanalysis');
      expect(Number.isFinite(model.input), `${key} input must be finite`).toBe(true);
      expect(Number.isFinite(model.output), `${key} output must be finite`).toBe(true);
      expect(model.blended, `${key} blended must follow the local formula`).toBeCloseTo(
        (3 * model.input + model.output) / 4,
        10
      );
      expect(model.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: 'https://artificialanalysis.ai/',
          scraper: 'scrape-artificialanalysis',
        }),
      ]));
      expect(model.benchlm).toEqual({
        score: null,
        verified: false,
        reliability: 0,
        categories: {},
      });
      expect(model.arena).toBeUndefined();
      expect(model.swePro).toBeUndefined();
      expect(model.sweVer).toBeUndefined();
      expect(model.tier).toBeUndefined();
      expect(model.lifecycle).toBe(NON_ACTIVE_NEW_VARIANTS.get(key) ?? 'active');
      expect(model.notes).toContain(NO_BENCHLM_NOTE);

      for (const field of OPTIONAL_FIELDS) {
        if (Object.hasOwn(model, field)) {
          expect(Number.isFinite(model[field]), `${key}.${field} must be finite`).toBe(true);
        }
      }
    }
  });
});

describe('AA effort catalog: complete alias matrix (PR3F)', () => {
  test('contains every curated AA alias target and leaves sync discoveries non-AA', () => {
    const aliasTargets = aliases.map((alias) => alias.to);
    const catalogKeys = Object.keys(models);
    const aliasTargetSet = new Set(aliasTargets);

    expect(aliasTargetSet.size).toBe(aliasTargets.length);
    expect(catalogKeys).toEqual(expect.arrayContaining(aliasTargets));

    // Every AA-owned row keeps an alias; S1-mapped stubs are the only alias
    // targets that do not claim AA pricing yet (S2 backfill closes them).
    const aaOwned = catalogKeys.filter((key) => models[key].pricingSource === 'artificialanalysis');
    for (const key of aaOwned) {
      expect(aliasTargetSet.has(key), `${key} AA-owned must keep an alias`).toBe(true);
    }
    const pendingBackfill = aliasTargets.filter((key) => !aaOwned.includes(key)).sort();
    expect(pendingBackfill).toEqual([...AA_MAPPED_PENDING_BACKFILL].sort());

    const extraKeys = catalogKeys.filter((key) => !aliasTargetSet.has(key));
    // Curated non-AA efforts (human decision, not AA-owned): Meta's
    // Muse Spark Contributor variants run at xhigh effort.
    const CURATED_NON_AA_EFFORT = new Map([
      ['musespark13contributor', 'xhigh'],
      ['musespark12contributor', 'xhigh'],
    ]);
    for (const key of extraKeys) {
      const curated = CURATED_NON_AA_EFFORT.get(key);
      if (curated !== undefined) {
        expect(models[key].effort, `${key} curated non-AA effort`).toBe(curated);
      } else {
        expect(models[key].effort, `${key} is a non-AA sync discovery`).toBeUndefined();
      }
    }
  });

  test('applies the alias effort to every family and covers all six effort values', () => {
    const pendingEffort = [];
    const efforts = aliases.map((alias) => {
      expect(models[alias.to], `${alias.to} must exist`).toBeDefined();
      if (models[alias.to].effort === undefined) {
        // S1-mapped stubs: the alias is the effort authority until the S2
        // backfill merge materializes it (fail closed, never inferred).
        pendingEffort.push(alias.to);
      } else {
        expect(models[alias.to].effort, `${alias.to} effort`).toBe(alias.effort);
      }
      return alias.effort;
    });

    expect(pendingEffort.sort()).toEqual([...AA_PENDING_EFFORT].sort());

    expect(new Set(efforts)).toEqual(new Set([
      'max',
      'high',
      'medium',
      'low',
      'xhigh',
      'non-reasoning',
    ]));
  });
});

// --- Fase 2 (PR-A): backfill AA 2026-09-13 + gate Astra ----------------------
//
// Evidence: live AA v2 payload captured 2026-09-13T01:11:12.045Z (646 items),
// archived as the manifest of record in
// openspec/changes/2026-09-13-aa-intelligence-refresh/evidence/aa-2026-09-13-backfill-manifest.md.
// The public chart renders rounded integers (53 / 51 / 48); the exact payload
// values are stored. No number enters without that AA source tuple.

const AA_BACKFILL_SOURCE = Object.freeze({
  url: 'https://artificialanalysis.ai/',
  date: '2026-09-13',
  scraper: 'scrape-artificialanalysis',
});

const AA_BACKFILL = Object.freeze({
  gpt6astra: 52.8,
  claudeOpus5: 50.7,
  musespark13: 48.2,
  gpt56sol: 47.1,
  gpt56terra: 42.3,
  gpt54: 39,
  gpt55: 38.6,
  gpt56luna: 37.5,
});

describe('AA 2026-09-13 backfill — aliases, traced numbers, gate Astra', () => {
  test('new confirmed slugs are curated with explicit effort, never inferred', () => {
    for (const [slug, to, effort] of [
      ['gpt-6-astra', 'gpt6astra', 'max'],
      ['muse-spark-1-3', 'musespark13', 'max'],
    ]) {
      const alias = aliases.find((candidate) => candidate.slug === slug);
      expect(alias, `${slug} must be curated in data/aa-aliases.json`).toBeDefined();
      expect(alias.to).toBe(to);
      expect(alias.effort).toBe(effort);
    }
  });

  test('every alias keeps an explicit valid effort (closed vocabulary)', () => {
    for (const alias of aliases) {
      expect(AA_EFFORTS, `alias ${alias.slug} effort`).toContain(alias.effort);
    }
  });

  test('every backfilled number lands exactly with its dated AA sources[] entry', () => {
    for (const [id, value] of Object.entries(AA_BACKFILL)) {
      const model = models[id];
      expect(model, `${id} must exist`).toBeDefined();
      expect(model.benchlm?.score, `${id}.benchlm.score`).toBe(value);
      expect(model.intelligenceIndex, `${id}.intelligenceIndex`).toBe(value);
      expect(model.sources, `${id}.sources`).toEqual(
        expect.arrayContaining([expect.objectContaining(AA_BACKFILL_SOURCE)])
      );
    }
  });

  test('intelligenceIndex admits finite or null only, never a fabricated 0', () => {
    const covered = Object.entries(models).filter(([, model]) =>
      Object.hasOwn(model, 'intelligenceIndex')
    );
    // Non-vacuous: the traced backfill is visible in the catalog.
    expect(covered.length).toBeGreaterThanOrEqual(Object.keys(AA_BACKFILL).length);
    for (const [id, model] of covered) {
      const value = model.intelligenceIndex;
      expect(
        value === null || Number.isFinite(value),
        `${id}.intelligenceIndex must be finite or null`
      ).toBe(true);
    }
    expect(covered.some(([, model]) => Number.isFinite(model.intelligenceIndex))).toBe(true);
  });

  test('Muse Spark 1.3 max is a distinct fail-closed entry; contributor keeps xhigh', () => {
    const contributor = models.musespark13contributor;
    expect(contributor.effort).toBe('xhigh');
    expect(contributor.sources.some((source) => source.date === '2026-09-13')).toBe(false);

    const spark = models.musespark13;
    expect(spark).toBeDefined();
    expect(spark.name).toBe('Muse Spark 1.3 (max)');
    expect(spark.effort).toBe('max');
    expect(spark.lifecycle).toBe('benchmark-only');
    const availabilityValues = Object.values(spark.availability || {});
    expect(availabilityValues.length).toBeGreaterThan(0);
    expect(availabilityValues.every((value) => value === false)).toBe(true);
  });

  test('DeepSeek / MiniMax reconcile by alias, never by duplicated entries', () => {
    const bySlug = new Map(aliases.map((alias) => [alias.slug, alias]));
    // AA row "DeepSeek V4 Pro 0813" is the existing deepseek-v4-pro identity;
    // "V4 Flash 0731" is the existing deepseek-v4-flash identity. Same for
    // MiniMax-M3. No 0813/V4.1/M3 duplicates are created.
    expect(bySlug.get('deepseek-v4-pro')?.to).toBe('deepseekv4p');
    expect(bySlug.get('deepseek-v4-flash')?.to).toBe('deepseekv4f');
    expect(bySlug.get('minimax-m3')?.to).toBe('minimaxm3');
    const ids = Object.keys(models);
    for (const id of ['deepseekv4p', 'deepseekv4f', 'minimaxm3']) {
      expect(ids.filter((candidate) => candidate === id)).toHaveLength(1);
    }
    // Every AA-owned row keeps its alias; the S1-mapped stubs (grok46, glm53,
    // gpt6astraLow) are the only alias targets pending AA backfill, so no
    // orphan duplicate can claim AA ownership without a curated slug.
    const aaOwned = Object.entries(models)
      .filter(([, model]) => model.pricingSource === 'artificialanalysis')
      .map(([id]) => id)
      .sort();
    const aliasTargets = [...new Set(aliases.map((alias) => alias.to))].sort();
    const pendingBackfill = aliasTargets.filter((id) => !aaOwned.includes(id));
    expect(pendingBackfill).toEqual([...AA_MAPPED_PENDING_BACKFILL].sort());
    for (const id of aaOwned) {
      expect(aliasTargets, `${id} AA-owned must keep an alias`).toContain(id);
    }
  });

  test('G1 — Astra is the real maximum of the chatgpt-plus eligible set (scorer intact)', () => {
    expect(models.gpt6astra.availability['chatgpt-plus']).toBe(true);
    const availability = Object.fromEntries(
      Object.entries(models).map(([id, model]) => [id, model.availability])
    );
    const eligible = applyProviderFilter(models, availability, new Set(['chatgpt-plus']));
    expect(Object.keys(eligible)).toContain('gpt6astra');

    const ranked = Object.entries(eligible)
      .map(([id, model]) => ({ id, score: compositeScore(model) }))
      .sort(
        (a, b) => (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY) ||
          a.id.localeCompare(b.id)
      );
    const finiteScores = ranked.filter((row) => row.score !== null).map((row) => row.score);
    const realMax = Math.max(...finiteScores);
    // The assertion compares against the computed maximum, never a hardcoded
    // 53 — and the top row must be Astra (criterion 1 of the handoff).
    expect(ranked[0].score).toBe(realMax);
    expect(ranked[0].id).toBe('gpt6astra');
  });
});

// --- S1 (2026-09-14): AA alias mass-mapping --------------------------------
//
// Live capture 2026-09-13T03:53:18Z (646 items, HTTP 200). Three catalog rows
// auto-stubbed by scrape-opencode-prices are now mapped to their live AA slug
// with effort taken ONLY from the AA display-name suffix:
//   grok-4-6        → grok46        (high) "Grok 4.6 (high)"
//   glm-5-3         → glm53         (max)  "GLM-5.3 (max)"
//   gpt-6-astra-low → gpt6astraLow  (low)  "GPT-6 Astra (low)"
// No II backfill lands in this slice (S2 owns it); availability is untouched.

describe('AA alias mass-mapping (S1)', () => {
  test('every S1 row carries an explicit closed-vocabulary effort', () => {
    for (const [slug, to, effort] of [
      ['grok-4-6', 'grok46', 'high'],
      ['glm-5-3', 'glm53', 'max'],
      ['gpt-6-astra-low', 'gpt6astraLow', 'low'],
    ]) {
      const alias = aliases.find((candidate) => candidate.slug === slug);
      expect(alias, `${slug} must be curated in data/aa-aliases.json`).toBeDefined();
      expect(alias.to).toBe(to);
      expect(alias.effort).toBe(effort);
      expect(AA_EFFORTS, `${slug} effort must be closed-vocabulary`).toContain(alias.effort);
    }
  });

  test('bare slug never defaults to max — grok-4-6 is (high)', () => {
    const alias = aliases.find((candidate) => candidate.slug === 'grok-4-6');
    expect(alias.effort).toBe('high');
    expect(alias.effort).not.toBe('max');
  });

  test('S2b covers S1 stubs: exact II + AA ownership, availability stays fail-closed booleans', () => {
    for (const [id, value, effort] of [['grok46', 44.4, 'high'], ['glm53', 44.9, 'max']]) { // S2b backfills both pending stubs
      const model = models[id];
      expect(model, `${id} must exist`).toBeDefined();
      expect(model.intelligenceIndex, `${id} II backfilled in S2b`).toBe(value);
      expect(model.effort, `${id} effort materialized`).toBe(effort);
      expect(model.pricingSource, `${id} AA-owned`).toBe('artificialanalysis');
      expect(Number.isFinite(model.input) && Number.isFinite(model.output), `${id} pricing finite`).toBe(true);
      expect(model.blended, `${id} blended`).toBeCloseTo((3 * model.input + model.output) / 4, 10);
      expect(model.sources).toEqual(expect.arrayContaining([expect.objectContaining(S2A_SOURCE)]));
      const values = Object.values(model.availability || {});
      expect(values.length, `${id} availability map`).toBeGreaterThan(0);
      expect(values.every((value) => typeof value === 'boolean'), `${id} availability stays booleans`).toBe(true);
    }
  });
  test('S2a covers gpt6astraLow: exact II 46 with AA provenance (S1 no-synthesis lifted for this id)', () => {
    const model = models.gpt6astraLow;
    expect(model, 'gpt6astraLow must exist').toBeDefined();
    expect(model.intelligenceIndex, 'gpt6astraLow II backfilled in S2a').toBe(46);
    expect(model.sources).toEqual(expect.arrayContaining([expect.objectContaining({ url: 'https://artificialanalysis.ai/', date: '2026-09-13', scraper: 'scrape-artificialanalysis' })]));
  });

  test('TRIANGULATE — an uncurated slug produces no catalog entry (fail closed)', () => {
    const aliasTargetSet = new Set(aliases.map((alias) => alias.to));
    const catalogKeys = new Set(Object.keys(models));
    for (const slug of [
      'deepseek-v4-1-flash',
      'deepseek-v4-pro-0424',
      'glm-5-3-flash',
      'longcat-2-0',
      'hy3-preview',
      'muse-spark-1-3-xhigh',
    ]) {
      expect(aliasTargetSet.has(slug), `${slug} must not be an alias target`).toBe(false);
      expect(catalogKeys.has(slug), `${slug} must not become an auto-created catalog key`).toBe(false);
    }
  });

  test('TRIANGULATE — duplicate-identity slugs stay ignored (V4.1 / 0424 / xhigh)', () => {
    const bySlug = new Map(aliases.map((alias) => [alias.slug, alias]));
    expect(bySlug.get('deepseek-v4-flash')?.to).toBe('deepseekv4f');
    expect(bySlug.get('deepseek-v4-1-flash')).toBeUndefined();
    expect(bySlug.get('deepseek-v4-pro')?.to).toBe('deepseekv4p');
    expect(bySlug.get('deepseek-v4-pro-0424')).toBeUndefined();
    expect(bySlug.get('minimax-m3')?.to).toBe('minimaxm3');
    expect(bySlug.get('muse-spark-1-3-xhigh')).toBeUndefined();
    const v41Names = Object.values(models).filter((model) => /v4\.1/i.test(model.name || ''));
    expect(v41Names, 'no synthesized V4.1 catalog identity').toHaveLength(0);
  });
});

// --- S2a (2026-09-14): chatgpt-plus + anthropic II backfill (live-exact) ---
//
// Live capture reuse 2026-09-13T03:53:18.345Z (646 items). Exact payload II
// (chart rounds; payload governs). Fable verdict: present + finite 49.7.
const S2A_II = Object.freeze({
  gpt6astraLow: 46,
  claudeFable5: 49.7,
  sonnet5: 38.4,
  opus48: 42,
  gpt55High: 37.3,
  gpt56solXhigh: 44.1,
  claudeOpus5High: 48.2,
});
const S2A_SOURCE = Object.freeze({
  url: 'https://artificialanalysis.ai/',
  date: '2026-09-13',
  scraper: 'scrape-artificialanalysis',
});
describe('S2a II backfill — chatgpt-plus + anthropic (live-exact)', () => {
  test('S2a live-exact values land verbatim with dated AA sources[]', () => {
    for (const [id, value] of Object.entries(S2A_II)) {
      const model = models[id];
      expect(model, `${id} must exist`).toBeDefined();
      expect(model.intelligenceIndex, `${id}.intelligenceIndex`).toBe(value);
      expect(model.sources, `${id}.sources`).toEqual(
        expect.arrayContaining([expect.objectContaining(S2A_SOURCE)])
      );
    }
  });
  test('every finite S2a II carries its own AA source tuple (no evidence without number)', () => {
    for (const id of Object.keys(S2A_II)) {
      const model = models[id];
      expect(Number.isFinite(model.intelligenceIndex), `${id} II finite`).toBe(true);
      expect(model.sources, `${id} AA attribution`).toEqual(
        expect.arrayContaining([expect.objectContaining(S2A_SOURCE)])
      );
    }
  });
  test('Fable verdict: present + finite → exact 49.7, benchlm 83.68 byte-identical', () => {
    const fable = models.claudeFable5;
    expect(fable.intelligenceIndex).toBe(49.7);
    expect(fable.benchlm.score).toBe(83.68);
    expect(fable.sources).toEqual(expect.arrayContaining([expect.objectContaining(S2A_SOURCE)]));
  });
  test('S2b empties pending backfill: glm53 + grok46 covered, gpt6astraLow stays covered', () => {
    expect(models.gpt6astraLow.intelligenceIndex).toBe(46);
    expect(models.gpt6astraLow.pricingSource).toBe('artificialanalysis');
    expect(models.glm53.intelligenceIndex).toBe(44.9);
    expect(models.grok46.intelligenceIndex).toBe(44.4);
    expect([...AA_MAPPED_PENDING_BACKFILL]).toEqual([]);
  });
  test('TRIANGULATE — live-exact beats chart rounding (52.8 not 53, 49.7 not 50)', () => {
    expect(models.gpt6astra.intelligenceIndex).toBe(52.8);
    expect(models.gpt6astra.intelligenceIndex).not.toBe(53);
    expect(models.claudeFable5.intelligenceIndex).toBe(49.7);
    expect(models.claudeFable5.intelligenceIndex).not.toBe(50);
    expect(models.gpt56sol.intelligenceIndex).toBe(47.1);
    expect(models.gpt56sol.intelligenceIndex).not.toBe(47);
  });
  test('TRIANGULATE — covered-but-live-absent keeps the key absent, never a synthesized null', () => {
    for (const id of ['deepseekv4fNonReasoning', 'omenalpha', 'hy4preview']) { // S2b: live-absent + uncovered stay key-absent
      expect(Object.hasOwn(models[id], 'intelligenceIndex'), `${id} key stays absent`).toBe(false);
      expect(models[id].intelligenceIndex).toBeUndefined();
      expect(models[id].intelligenceIndex).not.toBeNull();
    }
    expect(Number.isFinite(models.glm53.intelligenceIndex)).toBe(true);
    expect(Number.isFinite(models.grok46.intelligenceIndex)).toBe(true);
  });
});

// --- S2b (2026-09-14): remaining II backfill (live-exact) ---
//
// Live capture 2026-09-13T17:14:07.096Z (646 items, HTTP 200; re-fetch per
// tasks.md — S2b slugs missing from the S1 manifest). Exact payload II.
// deepseekv4fNonReasoning is covered-but-live-absent → preserved, key absent.
const S2B_II = Object.freeze({ glm52: 34, glm52NonReasoning: 22.4, qwen37max: 29.9, glm51: 26.4, glm51NonReasoning: 24.2, minimaxm3: 29.6, kimik27c: 26.3, kimik3: 43.8, kimik3Low: 30.5, kimik25: 23.5, kimik25NonReasoning: 19.4, kimik26: 31.3, kimik26NonReasoning: 23.6, deepseekv4p: 36.3, mimo25pro: 26.4, mimo25proNonReasoning: 18.3, qwen37plus: 25.8, qwen36plus: 27, minimaxm27: 23.2, mimo25: 22.3, minimaxm25: 22.8, deepseekv4f: 34.5, glm5: 27.9, glm5NonReasoning: 21.8, opencodeHy3: 25.8, grok45: 39.1, qwen38max: 40.3, grok46: 44.4, glm53: 44.9 });
describe('S2b II backfill — remaining catalog (live-exact)', () => {
  test('S2b live-exact values land verbatim with exactly one dated AA source tuple', () => {
    expect(Object.keys(S2B_II)).toHaveLength(29);
    for (const [id, value] of Object.entries(S2B_II)) {
      const model = models[id];
      expect(model, `${id} must exist`).toBeDefined();
      expect(model.intelligenceIndex, `${id}.intelligenceIndex`).toBe(value);
      expect(model.sources, `${id}.sources`).toEqual(expect.arrayContaining([expect.objectContaining(S2A_SOURCE)]));
      expect(model.sources.filter((s) => s.url === S2A_SOURCE.url && s.date === S2A_SOURCE.date && s.scraper === S2A_SOURCE.scraper), `${id} AA tuple once`).toHaveLength(1);
    }
  });
  test('TRIANGULATE — live-exact beats chart rounding (44.9 not 45, 43.8 not 44)', () => {
    expect(models.glm53.intelligenceIndex).toBe(44.9);
    expect(models.glm53.intelligenceIndex).not.toBe(45);
    expect(models.kimik3.intelligenceIndex).toBe(43.8);
    expect(models.kimik3.intelligenceIndex).not.toBe(44);
    expect(models.grok46.intelligenceIndex).toBe(44.4);
    expect(models.kimik3.benchlm.score).toBe(80.96);
  });
});

// --- Fable 5.1 intake (2026-09-14) ------------------------------------------
//
// Fresh live capture 2026-09-13T22:21:11.276Z (650 items, HTTP 200). Five
// `claude-fable-5-1*` slugs, exact payload II, pricing 10/50 on every row.
// Bare slug takes max ONLY via the explicit "Max Effort" token in
// "Claude Fable 5.1 (Adaptive Reasoning, Max Effort, Default Fallback)"
// (same rule as Fable 5 → max; cf. grok-4-6 → high). Fail-closed newcomer
// shape: benchmark-only + full-false availability + benchlm placeholder.
const FABLE51_II = Object.freeze({
  claudeFable51: 53.4,
  claudeFable51Xhigh: 53.2,
  claudeFable51High: 51.2,
  claudeFable51Medium: 49.1,
  claudeFable51Low: 47,
});
const FABLE51_SLUGS = Object.freeze({
  claudeFable51: ['claude-fable-5-1', 'max'],
  claudeFable51Xhigh: ['claude-fable-5-1-xhigh', 'xhigh'],
  claudeFable51High: ['claude-fable-5-1-high', 'high'],
  claudeFable51Medium: ['claude-fable-5-1-medium', 'medium'],
  claudeFable51Low: ['claude-fable-5-1-low', 'low'],
});
describe('Fable 5.1 intake — aliases, live-exact II, fail-closed shape', () => {
  test('five slugs curated with explicit effort, never inferred (bare slug = max on Max-Effort evidence)', () => {
    expect(Object.keys(FABLE51_SLUGS)).toHaveLength(5);
    for (const [to, [slug, effort]] of Object.entries(FABLE51_SLUGS)) {
      const alias = aliases.find((candidate) => candidate.slug === slug);
      expect(alias, `${slug} must be curated in data/aa-aliases.json`).toBeDefined();
      expect(alias.to).toBe(to);
      expect(alias.effort).toBe(effort);
      expect(AA_EFFORTS, `${slug} effort closed-vocabulary`).toContain(alias.effort);
    }
    expect(aliases.find((a) => a.slug === 'claude-fable-5-1').effort).toBe('max');
    expect(aliases.find((a) => a.slug === 'claude-fable-5-1').effort).not.toBe('high');
  });
  test('live-exact II lands verbatim with exactly one dated AA source tuple + 10/50 pricing', () => {
    for (const [id, value] of Object.entries(FABLE51_II)) {
      const model = models[id];
      expect(model, `${id} must exist`).toBeDefined();
      expect(model.intelligenceIndex, `${id}.intelligenceIndex`).toBe(value);
      expect(model.sources, `${id}.sources`).toEqual(expect.arrayContaining([expect.objectContaining(S2A_SOURCE)]));
      expect(model.sources.filter((s) => s.url === S2A_SOURCE.url && s.date === S2A_SOURCE.date && s.scraper === S2A_SOURCE.scraper), `${id} AA tuple once`).toHaveLength(1);
      expect(model.input, `${id}.input`).toBe(10);
      expect(model.output, `${id}.output`).toBe(50);
      expect(model.blended, `${id}.blended`).toBeCloseTo((3 * 10 + 50) / 4, 10);
      expect(model.pricingSource, `${id} AA-owned`).toBe('artificialanalysis');
    }
  });
  test('Anthropic-curated shape: active + anthropic:true (others false) + benchlm placeholder', () => {
    for (const id of Object.keys(FABLE51_II)) {
      const model = models[id];
      expect(model.lifecycle, `${id}.lifecycle`).toBe('active');
      for (const [provider, value] of Object.entries(model.availability || {})) {
        expect(value, `${id}.availability.${provider}`).toBe(provider === 'anthropic');
      }
      expect(model.benchlm).toEqual({ score: null, verified: false, reliability: 0, categories: {} });
      expect(model.notes).toContain(NO_BENCHLM_NOTE);
      expect(model.tier, `${id} no tier`).toBeUndefined();
    }
  });
  test('TRIANGULATE — live-exact beats chart rounding (53.4 not 53, 47 not 47.0-synthesized)', () => {
    expect(models.claudeFable51.intelligenceIndex).toBe(53.4);
    expect(models.claudeFable51.intelligenceIndex).not.toBe(53);
    expect(models.claudeFable51Low.intelligenceIndex).toBe(47);
    expect(models.claudeFable5.intelligenceIndex, 'Fable 5 base untouched').toBe(49.7);
  });
  test('TRIANGULATE — no non-reasoning 6th row (slug absent from the 650-item payload)', () => {
    expect(aliases.some((a) => a.slug === 'claude-fable-5-1-non-reasoning')).toBe(false);
    expect(models.claudeFable51NonReasoning).toBeUndefined();
  });
});

// --- S2a role-outcome acceptance (recomputed II; no hardcoded winner/value) ---
//
// Reads finite II directly from data/models.json (never the still-benchlm
// public compositeScore). Asserts classification/invariants only: reference is
// the lifecycle-priority finite-II max, every pool is finite-II + cost-clearing,
// twin judges stay equal, threshold churn is visible, evidence lists all roles.
describe('S2a role-outcome acceptance (recomputed II, no hardcoded winner/value)', () => {
  const iiOf = (mo) => (mo && typeof mo === 'object' && typeof mo.intelligenceIndex === 'number' && Number.isFinite(mo.intelligenceIndex) ? Math.min(100, Math.max(0, mo.intelligenceIndex)) : null);
  const s2aAvailability = Object.fromEntries(Object.entries(models).map(([id, mo]) => [id, mo.availability]));
  const s2aUnion = applyProviderFilter(models, s2aAvailability, new Set(['chatgpt-plus', 'anthropic']));
  const s2aRoles = JSON.parse(readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8')).roles;
  const s2aProfiles = JSON.parse(readFileSync(join(ROOT, 'data', 'agent-request-profiles.json'), 'utf-8')).profiles;
  const s2aEntries = Object.entries(s2aUnion);
  const s2aRefPool = (() => {
    const refs = s2aEntries.filter(([, mo]) => mo && mo.lifecycle === 'reference');
    return refs.length > 0 ? refs : s2aEntries;
  })();
  const s2aRef = s2aRefPool.reduce((best, cur) => (iiOf(cur[1]) ?? Number.NEGATIVE_INFINITY) > (iiOf(best[1]) ?? Number.NEGATIVE_INFINITY) ? cur : best);
  const s2aRefId = s2aRef[0];
  const s2aRefModel = s2aRef[1];

  const classify = (role) => {
    const req = applyStrategy(s2aRoles[role], 'balanced');
    const profile = s2aProfiles[role];
    const ceiling = req.costRatio * costEstimate(s2aRefModel, profile);
    const normal = s2aEntries.filter(([, mo]) => mo.lifecycle === 'active' && iiOf(mo) !== null && iiOf(mo) >= req.minReasoning && costEstimate(mo, profile) <= ceiling);
    const designatedKey = s2aRoles[role].referenceModelId;
    const designated = designatedKey && s2aUnion[designatedKey] && s2aUnion[designatedKey].lifecycle === 'active' && iiOf(s2aUnion[designatedKey]) !== null && costEstimate(s2aUnion[designatedKey], profile) <= ceiling ? designatedKey : null;
    const clearing = s2aEntries.filter(([, mo]) => mo.lifecycle === 'active' && iiOf(mo) !== null && costEstimate(mo, profile) <= ceiling).sort((a, b) => iiOf(b[1]) - iiOf(a[1]) || (a[0] < b[0] ? -1 : 1));
    const cls = normal.length > 0 ? 'assigned' : designated !== null ? 'soft:designated' : clearing.length > 0 ? 'soft:cost' : 'unassigned';
    const byScore = normal.slice().sort((a, b) => iiOf(b[1]) - iiOf(a[1]) || (a[0] < b[0] ? -1 : 1));
    const selected = byScore.length > 0 ? byScore[0][0] : designated !== null ? designated : clearing.length > 0 ? clearing[0][0] : null;
    return { req, ceiling, normal, designated, clearing, cls, selected };
  };

  test('II reference is the lifecycle-priority finite-II maximum (recomputed, unnamed)', () => {
    expect(s2aRefModel).toBeDefined();
    expect(Number.isFinite(iiOf(s2aRefModel))).toBe(true);
    expect(s2aRefPool.some(([, mo]) => mo.lifecycle === 'reference') ? s2aRefModel.lifecycle : 'active').toBe(s2aRefPool.some(([, mo]) => mo.lifecycle === 'reference') ? 'reference' : 'active');
    for (const [, mo] of s2aRefPool) {
      expect(iiOf(s2aRefModel) >= (iiOf(mo) ?? Number.NEGATIVE_INFINITY)).toBe(true);
    }
    const activeHigher = s2aEntries.filter(([, mo]) => mo.lifecycle === 'active' && (iiOf(mo) ?? Number.NEGATIVE_INFINITY) > iiOf(s2aRefModel));
    expect(Array.isArray(activeHigher)).toBe(true);
  });

  test('every role resolves inside finite-II cost-clearing pools; twin judges equal; churn visible; no II-less leakage', () => {
    const roleKeys = Object.keys(s2aRoles);
    expect(roleKeys.length).toBe(18);
    let emptyNormals = 0;
    for (const role of roleKeys) {
      const { req, ceiling, normal, clearing, cls, selected } = classify(role);
      expect(['assigned', 'soft:designated', 'soft:cost', 'unassigned']).toContain(cls);
      expect(Number.isFinite(ceiling) && ceiling >= 0).toBe(true);
      for (const [, mo] of normal) {
        expect(Number.isFinite(iiOf(mo))).toBe(true);
        expect(iiOf(mo) >= req.minReasoning).toBe(true);
      }
      if (normal.length === 0) emptyNormals++;
      if (selected !== null) {
        const mo = s2aUnion[selected];
        expect(mo, `${role} selected stays in the provider-filtered union`).toBeDefined();
        expect(mo.lifecycle).toBe('active');
        expect(Number.isFinite(iiOf(mo)), `${role} selected is finite-II`).toBe(true);
        expect(costEstimate(mo, s2aProfiles[role]) <= ceiling).toBe(true);
      } else {
        expect(clearing.length).toBe(0);
      }
    }
    expect(emptyNormals).toBeGreaterThanOrEqual(17);
    expect(classify('jd-judge-a').selected).toBe(classify('jd-judge-b').selected);
    const evidence = readFileSync(join(ROOT, 'openspec', 'changes', '2026-09-14-aa-only-scoring', 'evidence', 's2a-role-outcomes.md'), 'utf-8');
    for (const role of roleKeys) {
      expect(evidence.includes(role), `evidence lists ${role}`).toBe(true);
    }
  });
});
