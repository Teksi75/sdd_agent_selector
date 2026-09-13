// @vitest-environment node
// tests/aa-effort.test.js
// Catalog schema-4 and GPT-5.6 Luna consolidation contract for PR3A.

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AA_EFFORTS } from '../scripts/_aa-safety.mjs';
import { applyProviderFilter } from '../js/services/provider-filter.js';
import { compositeScore } from '../js/services/model-scorer.js';

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

// Pre-variant curated records: they existed (or land via one-shot curation)
// outside the PR3A variant materialization, so the PR3B variant contract
// below does not apply to them. gpt6astra/gpt6astraLow are manual OpenAI docs
// curation; musespark13 is the 2026-09-13 AA max backfill (benchmark-only),
// distinct from musespark13contributor (xhigh).
const PRE_VARIANT_KEYS = new Set([
  'gpt6astra',
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

const NON_ACTIVE_NEW_VARIANTS = new Map([
  ['glm51NonReasoning', 'legacy'],
  ['glm5NonReasoning', 'legacy'],
  ['gpt55High', 'reference'],
  ['gpt55Medium', 'reference'],
  ['gpt55Low', 'reference'],
  ['gpt55NonReasoning', 'reference'],
]);

const EXPECTED_VARIANT_NAMES = {
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

    const extraKeys = catalogKeys.filter((key) => !aliasTargetSet.has(key));
    // Curated non-AA efforts (human decision, not AA-owned): Meta's
    // Muse Spark Contributor variants run at xhigh effort.
    const CURATED_NON_AA_EFFORT = new Map([
      ['musespark13contributor', 'xhigh'],
      ['musespark12contributor', 'xhigh'],
      // Astra low stays a curated non-AA row in this slice; the (max) base
      // becomes AA-owned via the 2026-09-13 backfill.
      ['gpt6astraLow', 'low'],
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
    const efforts = aliases.map((alias) => {
      expect(models[alias.to], `${alias.to} must exist`).toBeDefined();
      expect(models[alias.to].effort, `${alias.to} effort`).toBe(alias.effort);
      return alias.effort;
    });

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
    // The AA-owned catalog set equals the curated alias target set: no orphan
    // duplicate can claim AA ownership without a curated slug.
    const aaOwned = Object.entries(models)
      .filter(([, model]) => model.pricingSource === 'artificialanalysis')
      .map(([id]) => id)
      .sort();
    const aliasTargets = [...new Set(aliases.map((alias) => alias.to))].sort();
    expect(aaOwned).toEqual(aliasTargets);
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
