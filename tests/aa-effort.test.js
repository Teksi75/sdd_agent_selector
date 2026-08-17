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

const EXPECTED_NEW_VARIANTS = {
  glm52NonReasoning: {
    name: 'GLM-5.2 (Non-reasoning)',
    input: 1.4,
    output: 4.4,
    blended: 2.15,
    optional: {
      term: 51.685393258427,
      codingIndex: 46.5,
      outputTokensPerSecond: 121.062,
      timeToFirstTokenSeconds: 1.444,
      timeToFirstAnswerTokenSeconds: 1.444,
    },
  },
  glm51NonReasoning: {
    name: 'GLM-5.1 (Non-reasoning)',
    input: 1.38,
    output: 4.4,
    blended: 2.135,
    optional: {
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  kimik3Low: {
    name: 'Kimi K3 (low)',
    input: 3,
    output: 15,
    blended: 6,
    optional: {
      term: 82.3970037453184,
      codingIndex: 72,
      outputTokensPerSecond: 39.067,
      timeToFirstTokenSeconds: 2.259,
      timeToFirstAnswerTokenSeconds: 53.453,
    },
  },
  kimik25NonReasoning: {
    name: 'Kimi K2.5 (Non-reasoning)',
    input: 0.6,
    output: 3,
    blended: 1.2,
    optional: {
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  kimik26NonReasoning: {
    name: 'Kimi K2.6 (Non-reasoning)',
    input: 0.95,
    output: 4,
    blended: 1.7125,
    optional: {
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  mimo25proNonReasoning: {
    name: 'MiMo-V2.5-Pro (Non-reasoning)',
    input: 0.435,
    output: 0.87,
    blended: 0.54375,
    optional: {
      outputTokensPerSecond: 52.633,
      timeToFirstTokenSeconds: 2.452,
      timeToFirstAnswerTokenSeconds: 2.452,
    },
  },
  deepseekv4fNonReasoning: {
    name: 'DeepSeek V4 Flash (Non-reasoning)',
    input: 0.14,
    output: 0.28,
    blended: 0.175,
    optional: {
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  glm5NonReasoning: {
    name: 'GLM-5 (Non-reasoning)',
    input: 1,
    output: 3.2,
    blended: 1.55,
    optional: {
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  gpt55High: {
    name: 'GPT-5.5 (high)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 79.4007490636704,
      codingIndex: 71.6,
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  gpt55Medium: {
    name: 'GPT-5.5 (medium)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 80.5243445692884,
      codingIndex: 71.5,
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  gpt55Low: {
    name: 'GPT-5.5 (low)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 65.5430711610487,
      codingIndex: 60.9,
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  gpt55NonReasoning: {
    name: 'GPT-5.5 (Non-reasoning)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 61.0486891385768,
      codingIndex: 56.5,
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  gpt54Low: {
    name: 'GPT-5.4 (low)',
    input: 2.5,
    output: 15,
    blended: 5.625,
    optional: {
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  gpt54NonReasoning: {
    name: 'GPT-5.4 (Non-reasoning)',
    input: 2.5,
    output: 15,
    blended: 5.625,
    optional: {
      outputTokensPerSecond: 0,
      timeToFirstTokenSeconds: 0,
      timeToFirstAnswerTokenSeconds: 0,
    },
  },
  gpt56terraXhigh: {
    name: 'GPT-5.6 Terra (xhigh)',
    input: 2,
    output: 12,
    blended: 4.5,
    optional: {
      term: 80.1498127340824,
      codingIndex: 70.6,
      outputTokensPerSecond: 111.402,
      timeToFirstTokenSeconds: 8.799,
      timeToFirstAnswerTokenSeconds: 8.799,
    },
  },
  gpt56terraHigh: {
    name: 'GPT-5.6 Terra (high)',
    input: 2,
    output: 12,
    blended: 4.5,
    optional: {
      term: 75.6554307116105,
      codingIndex: 67.1,
      outputTokensPerSecond: 101.571,
      timeToFirstTokenSeconds: 2.535,
      timeToFirstAnswerTokenSeconds: 2.535,
    },
  },
  gpt56terraMedium: {
    name: 'GPT-5.6 Terra (medium)',
    input: 2,
    output: 12,
    blended: 4.5,
    optional: {
      term: 72.2846441947566,
      codingIndex: 64.7,
      outputTokensPerSecond: 98.219,
      timeToFirstTokenSeconds: 1.658,
      timeToFirstAnswerTokenSeconds: 1.658,
    },
  },
  gpt56terraLow: {
    name: 'GPT-5.6 Terra (low)',
    input: 2,
    output: 12,
    blended: 4.5,
    optional: {
      term: 62.5468164794007,
      codingIndex: 58.1,
      outputTokensPerSecond: 99.02,
      timeToFirstTokenSeconds: 1.323,
      timeToFirstAnswerTokenSeconds: 1.323,
    },
  },
  gpt56terraNonReasoning: {
    name: 'GPT-5.6 Terra (Non-reasoning)',
    input: 2,
    output: 12,
    blended: 4.5,
    optional: {
      term: 56.1797752808989,
      codingIndex: 52.3,
      outputTokensPerSecond: 97.922,
      timeToFirstTokenSeconds: 0.76,
      timeToFirstAnswerTokenSeconds: 0.76,
    },
  },
  gpt56lunaXhigh: {
    name: 'GPT-5.6 Luna (xhigh)',
    input: 0.2,
    output: 1.2,
    blended: 0.45,
    optional: {
      term: 77.9026217228464,
      codingIndex: 68.6,
      outputTokensPerSecond: 170.161,
      timeToFirstTokenSeconds: 21.142,
      timeToFirstAnswerTokenSeconds: 21.142,
    },
  },
  gpt56lunaHigh: {
    name: 'GPT-5.6 Luna (high)',
    input: 0.2,
    output: 1.2,
    blended: 0.45,
    optional: {
      term: 69.6629213483146,
      codingIndex: 63.3,
      outputTokensPerSecond: 165.495,
      timeToFirstTokenSeconds: 8.011,
      timeToFirstAnswerTokenSeconds: 8.011,
    },
  },
  gpt56lunaMedium: {
    name: 'GPT-5.6 Luna (medium)',
    input: 0.2,
    output: 1.2,
    blended: 0.45,
    optional: {
      term: 53.1835205992509,
      codingIndex: 50.7,
      outputTokensPerSecond: 156.913,
      timeToFirstTokenSeconds: 2.398,
      timeToFirstAnswerTokenSeconds: 2.398,
    },
  },
  gpt56lunaLow: {
    name: 'GPT-5.6 Luna (low)',
    input: 0.2,
    output: 1.2,
    blended: 0.45,
    optional: {
      term: 43.4456928838951,
      codingIndex: 44.2,
      outputTokensPerSecond: 161.388,
      timeToFirstTokenSeconds: 1.597,
      timeToFirstAnswerTokenSeconds: 1.597,
    },
  },
  gpt56lunaNonReasoning: {
    name: 'GPT-5.6 Luna (Non-reasoning)',
    input: 0.2,
    output: 1.2,
    blended: 0.45,
    optional: {
      term: 38.9513108614232,
      codingIndex: 39.3,
      outputTokensPerSecond: 155.137,
      timeToFirstTokenSeconds: 0.706,
      timeToFirstAnswerTokenSeconds: 0.706,
    },
  },
  gpt56solXhigh: {
    name: 'GPT-5.6 Sol (xhigh)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 89.5131086142322,
      codingIndex: 78.3,
      outputTokensPerSecond: 63.073,
      timeToFirstTokenSeconds: 28.138,
      timeToFirstAnswerTokenSeconds: 28.138,
    },
  },
  gpt56solHigh: {
    name: 'GPT-5.6 Sol (high)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 87.2659176029963,
      codingIndex: 77.2,
      outputTokensPerSecond: 63.506,
      timeToFirstTokenSeconds: 9.608,
      timeToFirstAnswerTokenSeconds: 9.608,
    },
  },
  gpt56solMedium: {
    name: 'GPT-5.6 Sol (medium)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 86.1423220973783,
      codingIndex: 76.3,
      outputTokensPerSecond: 57.495,
      timeToFirstTokenSeconds: 3.841,
      timeToFirstAnswerTokenSeconds: 3.841,
    },
  },
  gpt56solLow: {
    name: 'GPT-5.6 Sol (low)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 76.7790262172285,
      codingIndex: 69.7,
      outputTokensPerSecond: 59.39,
      timeToFirstTokenSeconds: 2.335,
      timeToFirstAnswerTokenSeconds: 2.335,
    },
  },
  gpt56solNonReasoning: {
    name: 'GPT-5.6 Sol (Non-reasoning)',
    input: 5,
    output: 30,
    blended: 11.25,
    optional: {
      term: 74.1573033707865,
      codingIndex: 65.1,
      outputTokensPerSecond: 60.163,
      timeToFirstTokenSeconds: 1.206,
      timeToFirstAnswerTokenSeconds: 1.206,
    },
  },
  sonnet5High: {
    name: 'Claude Sonnet 5 (Adaptive Reasoning, High Effort)',
    input: 2,
    output: 10,
    blended: 4,
    optional: {
      outputTokensPerSecond: 61.463,
      timeToFirstTokenSeconds: 5.909,
      timeToFirstAnswerTokenSeconds: 5.909,
    },
  },
  sonnet5Xhigh: {
    name: 'Claude Sonnet 5 (Adaptive Reasoning, Xhigh Effort)',
    input: 2,
    output: 10,
    blended: 4,
    optional: {
      outputTokensPerSecond: 68.512,
      timeToFirstTokenSeconds: 13.234,
      timeToFirstAnswerTokenSeconds: 13.234,
    },
  },
  sonnet5Medium: {
    name: 'Claude Sonnet 5 (Adaptive Reasoning, Medium Effort)',
    input: 2,
    output: 10,
    blended: 4,
    optional: {
      outputTokensPerSecond: 59.697,
      timeToFirstTokenSeconds: 1.694,
      timeToFirstAnswerTokenSeconds: 1.694,
    },
  },
  sonnet5Low: {
    name: 'Claude Sonnet 5 (Adaptive Reasoning, Low Effort)',
    input: 2,
    output: 10,
    blended: 4,
    optional: {
      outputTokensPerSecond: 60.926,
      timeToFirstTokenSeconds: 1.286,
      timeToFirstAnswerTokenSeconds: 1.286,
    },
  },
  sonnet5NonReasoning: {
    name: 'Claude Sonnet 5 (Non-reasoning, High Effort)',
    input: 2,
    output: 10,
    blended: 4,
    optional: {
      term: 75.2808988764045,
      codingIndex: 66.4,
      outputTokensPerSecond: 57.74,
      timeToFirstTokenSeconds: 0.8,
      timeToFirstAnswerTokenSeconds: 0.8,
    },
  },
  haiku45Reasoning: {
    name: 'Claude 4.5 Haiku (Reasoning)',
    input: 1,
    output: 5,
    blended: 2,
    optional: {
      term: 44.1947565543071,
      codingIndex: 43.9,
      mathIndex: 83.7,
      outputTokensPerSecond: 95.642,
      timeToFirstTokenSeconds: 7.748,
      timeToFirstAnswerTokenSeconds: 7.748,
    },
  },
  claudeOpus5High: {
    name: 'Claude Opus 5 (Adaptive Reasoning, High Effort)',
    input: 5,
    output: 25,
    blended: 10,
    optional: {
      term: 87.6404494382023,
      codingIndex: 76.5,
      outputTokensPerSecond: 47.795,
      timeToFirstTokenSeconds: 10.025,
      timeToFirstAnswerTokenSeconds: 10.025,
    },
  },
  claudeOpus5Xhigh: {
    name: 'Claude Opus 5 (Adaptive Reasoning, Xhigh Effort)',
    input: 5,
    output: 25,
    blended: 10,
    optional: {
      term: 88.0149812734082,
      codingIndex: 77,
      outputTokensPerSecond: 47.823,
      timeToFirstTokenSeconds: 22.894,
      timeToFirstAnswerTokenSeconds: 22.894,
    },
  },
  claudeOpus5Medium: {
    name: 'Claude Opus 5 (Adaptive Reasoning, Medium Effort)',
    input: 5,
    output: 25,
    blended: 10,
    optional: {
      term: 86.1423220973783,
      codingIndex: 74.3,
      outputTokensPerSecond: 48.147,
      timeToFirstTokenSeconds: 3.692,
      timeToFirstAnswerTokenSeconds: 3.692,
    },
  },
  claudeOpus5Low: {
    name: 'Claude Opus 5 (Adaptive Reasoning, Low Effort)',
    input: 5,
    output: 25,
    blended: 10,
    optional: {
      term: 76.4044943820225,
      codingIndex: 66.9,
      outputTokensPerSecond: 47.277,
      timeToFirstTokenSeconds: 2.4,
      timeToFirstAnswerTokenSeconds: 2.4,
    },
  },
};

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

    expect(luna.benchlm).toMatchObject({
      score: 67.17,
      verified: false,
      evidence: 'estimated',
    });
    expect(sol.benchlm.verified).toBe(true);
    expect(sol.benchlm.score).toBe(81.96);
    expect(luna.benchlm.score).toBeLessThan(sol.benchlm.score);
  });

  test('adopts AA pricing and preserves both benchmark sources', () => {
    const luna = models.gpt56luna;

    expect(luna.input).toBe(0.2);
    expect(luna.output).toBe(1.2);
    expect(luna.blended).toBe(0.45);
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

describe('AA effort catalog: GLM/Kimi/MiMo/DeepSeek variants (PR3B)', () => {
  test('adds the current variant entries with the exact AA variant contract', () => {
    expect(Object.keys(EXPECTED_NEW_VARIANTS)).toHaveLength(39);

    for (const [key, expected] of Object.entries(EXPECTED_NEW_VARIANTS)) {
      const model = models[key];
      const alias = aliases.find((candidate) => candidate.to === key);

      expect(model, `${key} must exist`).toBeDefined();
      expect(alias, `${key} must have an alias`).toBeDefined();
      expect(model.name).toBe(expected.name);
      expect(model.effort).toBe(alias.effort);
      expect(model.input).toBe(expected.input);
      expect(model.output).toBe(expected.output);
      expect(model.blended).toBeCloseTo(expected.blended, 12);
      expect(model.pricingSource).toBe('artificialanalysis');
      expect(model.sources).toEqual([{
        url: 'https://artificialanalysis.ai/',
        date: '2026-08-16',
        scraper: 'scrape-artificialanalysis',
      }]);
      expect(model.cacheRead).toBeUndefined();
      expect(model.cacheWrite).toBeUndefined();
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
        if (Object.hasOwn(expected.optional, field)) {
          expect(model[field]).toBe(expected.optional[field]);
        } else {
          expect(model[field]).toBeUndefined();
        }
      }
    }
  });
});

describe('AA effort catalog: complete alias matrix (PR3F)', () => {
  test('contains exactly the 69 curated alias targets and 39 new variants', () => {
    const aliasTargets = aliases.map((alias) => alias.to);
    const newKeys = aliases
      .filter((alias) => !PRE_VARIANT_KEYS.has(alias.to))
      .map((alias) => alias.to);

    expect(aliases).toHaveLength(69);
    expect(newKeys).toHaveLength(39);
    expect(new Set(newKeys)).toEqual(new Set(Object.keys(EXPECTED_NEW_VARIANTS)));
    expect(Object.keys(models)).toHaveLength(69);
    expect(Object.keys(models).sort()).toEqual([...aliasTargets].sort());
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
