// @vitest-environment node
// tests/aa-effort.test.js
// Catalog schema-4 and GPT-5.6 Luna consolidation contract for PR3A.

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const PRE_VARIANT_KEYS = new Set([
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
  test('declares catalog schema version 4', () => {
    expect(raw._meta.schemaVersion).toBe(4);
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
    for (const key of extraKeys) {
      expect(models[key].effort, `${key} is a non-AA sync discovery`).toBeUndefined();
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
