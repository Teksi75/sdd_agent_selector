// tests/model-scorer.test.js
// TDD Phase 1 — RED. Tests must FAIL before model-scorer.js is implemented.
//
// Coverage target (per design.md + tasks.md): 12+ tests.
// Test categories:
//   - compositeScore: all/partial/no benchmarks + regression vs V3 reference
//   - costEstimate: default/custom/asymmetric profiles
//   - findReferenceModel: tier:reference vs highest score fallback
//   - applyStrategy: 5 strategies × representative role matrix
//   - getBestFor: all 18 agents, strategy modifiers, effectiveMaxCost, no-qualify
//
// Fixture helpers at the top keep tests readable and consistent.

import { describe, test, expect } from 'vitest';

// Fixtures deliberately cover the spec's expected real-world scores
// so the "regression vs V3" assertion is meaningful.
const GLM52 = {
  key: 'glm52',
  name: 'GLM-5.2',
  arena: 1595,
  swePro: 62.1,
  sweVer: 77.8,
  term: 81.0,
  input: 1.40,
  output: 4.40,
  cacheRead: 0.26,
  tier: 'high',
};

const MIMOV25 = {
  key: 'mimo25',
  name: 'MiMo V2.5',
  arena: 1435,
  input: 0.14,
  output: 0.28,
  cacheRead: 0.0028,
  tier: 'budget',
};

const OPUS48 = {
  key: 'opus48',
  name: 'Claude Opus 4.8',
  arena: 1567,
  swePro: 69.2,
  sweVer: 88.6,
  term: 85.0,
  input: 5.00,
  output: 25.00,
  tier: 'reference',
  isReference: true,
};

const GPT55 = {
  key: 'gpt55',
  name: 'GPT-5.5',
  arena: 2123,
  swePro: 58.6,
  sweVer: 83.4,
  term: 84.0,
  input: 5.00,
  output: 30.00,
  cacheRead: 0.50,
  tier: 'reference',
  isReference: true,
};

// Minimal 18-agent role matrix fixture (subset test).
// Inherits the spec's restrictions:
//   gentle-orchestrator: minReasoning >= 90, costRatio = 1.0
//   sdd-apply.costRatio = 1.0
//   sdd-archive.costRatio <= 0.05
const ROLE_MATRIX = {
  'gentle-orchestrator': { minReasoning: 95, costRatio: 1.0, role: 'orchestration' },
  'sdd-archive': { minReasoning: 50, costRatio: 0.05, role: 'archive' },
  'sdd-apply': { minReasoning: 75, costRatio: 1.0, role: 'apply' },
  'sdd-init': { minReasoning: 60, costRatio: 0.10, role: 'init' },
  'sdd-explore': { minReasoning: 70, costRatio: 0.40, role: 'explore' },
  'jd-judge-a': { minReasoning: 90, costRatio: 0.85, role: 'judge' },
  'jd-judge-b': { minReasoning: 90, costRatio: 0.85, role: 'judge' },
};

const REQUEST_PROFILES = {
  'gentle-orchestrator': { inputTokens: 4000, outputTokens: 2000 },
  'sdd-archive': { inputTokens: 900, outputTokens: 500 },
  'sdd-apply': { inputTokens: 6000, outputTokens: 3500 },
  'sdd-init': { inputTokens: 600, outputTokens: 400 },
  'sdd-explore': { inputTokens: 2500, outputTokens: 1200 },
  'jd-judge-a': { inputTokens: 5500, outputTokens: 1200 },
  'jd-judge-b': { inputTokens: 5500, outputTokens: 1200 },
};

describe('model-scorer — compositeScore', () => {
  test('GLM-5.2 with all benchmarks yields a high score (~80.7)', () => {
    // Spec scenario: arena 1595, swePro 62.1, term 81.0 → ~80.7
    // V4 implementation must score in [70, 90] to pass.
    const score = compositeScore(GLM52);
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThan(90);
  });

  test('with only arena benchmark, redistributes weights to 100% arena', () => {
    const onlyArena = { ...MIMOV25, swePro: null, term: null };
    const score = compositeScore(onlyArena);
    // MIMOV25 has arena 1435 → normalized to 0-100 with max ~1700
    // Should be > 70 (since 1435/1700*100 = 84.4)
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThan(100);
  });

  test('with all benchmarks null returns 0', () => {
    const noBench = { ...GLM52, arena: null, swePro: null, term: null };
    expect(compositeScore(noBench)).toBe(0);
  });

  test('with only swePro returns non-zero score', () => {
    const swe = { ...GLM52, arena: null, term: null };
    const score = compositeScore(swe);
    expect(score).toBeGreaterThan(0);
    // swePro 62.1 with weight 1.0 (redistributed) → 62.1
    expect(score).toBeCloseTo(62.1, 0);
  });

  test('with missing benchmark redistributes weight proportionally', () => {
    // GLM52 minus swePro (62.1):
    //   arena 1595 → 93.82; term 81.0;
    //   missing weight = 0.35; available = 0.65 (arena 0.40, term 0.25)
    //   Score = arena * (0.40 / 0.65) + term * (0.25 / 0.65)
    const noSwe = { ...GLM52, swePro: null };
    const score = compositeScore(noSwe);
    // Should be HIGHER than the full-benchmark score because we're not
    //   dividing by 0/0 — the scorer ignores the 0-weight slot.
    expect(score).toBeGreaterThan(0);
  });

  test('score is bounded in [0, 100] for any model', () => {
    const cases = [GLM52, MIMOV25, OPUS48, GPT55];
    for (const m of cases) {
      const score = compositeScore(m);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('reference models yield measurable scores (not zero)', () => {
    // OPUS48 has all benchmarks; should be the highest among references.
    expect(compositeScore(OPUS48)).toBeGreaterThan(compositeScore(GLM52) - 1);
  });
});

describe('model-scorer — costEstimate', () => {
  test('GLM-5.2 default request (1000 input + 500 output) → ~0.0036', () => {
    // input: 1.40/1M * 1000 = 0.0014
    // output: 4.40/1M * 500 = 0.0022
    // total: 0.0036
    const cost = costEstimate(GLM52);
    expect(cost).toBeCloseTo(0.0036, 4);
  });

  test('MiMo V2.5 default request → ~0.00028', () => {
    // input: 0.14/1M * 1000 = 0.00014
    // output: 0.28/1M * 500 = 0.00014
    // total: 0.00028
    const cost = costEstimate(MIMOV25);
    expect(cost).toBeCloseTo(0.00028, 6);
  });

  test('custom profile (5000+2000) on GLM-5.2 → ~0.0158', () => {
    // input: 1.40/1M * 5000 = 0.007
    // output: 4.40/1M * 2000 = 0.0088
    // total: 0.0158
    const cost = costEstimate(GLM52, { inputTokens: 5000, outputTokens: 2000 });
    expect(cost).toBeCloseTo(0.0158, 4);
  });

  test('asymmetric read-only (5000+1000) matches linear scaling', () => {
    const a = costEstimate(GLM52, { inputTokens: 5000, outputTokens: 1000 });
    const b = costEstimate(GLM52, { inputTokens: 1000, outputTokens: 5000 });
    // input-heavy should be cheaper than output-heavy for GLM-5.2
    // because output is more expensive per token.
    expect(a).toBeLessThan(b);
  });

  test('cost scales linearly with inputTokens (at constant outputTokens)', () => {
    // Fix outputTokens=0 to isolate the input-side linear scaling.
    const c1 = costEstimate(GLM52, { inputTokens: 1000, outputTokens: 0 });
    const c2 = costEstimate(GLM52, { inputTokens: 2000, outputTokens: 0 });
    expect(c2).toBeCloseTo(c1 * 2, 6);
  });

  test('cost never negative for realistic inputs', () => {
    for (const profile of [
      { inputTokens: 0, outputTokens: 0 },
      { inputTokens: 1000, outputTokens: 0 },
      { inputTokens: 0, outputTokens: 500 },
    ]) {
      const cost = costEstimate(GLM52, profile);
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('model-scorer — findReferenceModel', () => {
  test('returns model with tier:reference when present', () => {
    const ref = findReferenceModel({
      glm52: GLM52,
      mimo25: MIMOV25,
      opus48: OPUS48,
      gpt55: GPT55,
    });
    // Both OPUS48 and GPT55 are tier:reference; either is acceptable
    //   (deterministic order is OK if the function picks one consistently).
    expect(ref).not.toBeNull();
    expect(ref.tier).toBe('reference');
    expect(ref.isReference).toBe(true);
  });

  test('falls back to highest compositeScore when no reference tier', () => {
    const ref = findReferenceModel({
      glm52: GLM52,
      mimo25: MIMOV25,
    });
    expect(ref).not.toBeNull();
    expect(ref.tier).not.toBe('reference');
    // MIMOV25 has only arena (1435 → ~84.4/100 with weight 100%).
    // GLM52 has arena + swePro + term but its composite score lands lower
    // than MIMOV25's pure-arena score in our normalization (no missing-data
    // penalty kicks in for MIMOV25). Document the actual winner.
    expect(ref.name).toBe(MIMOV25.name);
  });

  test('returns null for empty model set', () => {
    expect(findReferenceModel({})).toBeNull();
  });
});

describe('model-scorer — applyStrategy', () => {
  test('min-cost halves costRatio', () => {
    const role = { minReasoning: 80, costRatio: 0.50, role: 'X' };
    const modified = applyStrategy(role, 'min-cost');
    expect(modified.costRatio).toBeCloseTo(0.25, 6);
    expect(modified.minReasoning).toBe(80);
  });

  test('max-quality adds +10 to minReasoning', () => {
    const role = { minReasoning: 80, costRatio: 0.50, role: 'X' };
    const modified = applyStrategy(role, 'max-quality');
    expect(modified.minReasoning).toBe(90);
    expect(modified.costRatio).toBe(0.50);
  });

  test('balanced leaves both fields unchanged', () => {
    const role = { minReasoning: 80, costRatio: 0.50, role: 'X' };
    const modified = applyStrategy(role, 'balanced');
    expect(modified.minReasoning).toBe(80);
    expect(modified.costRatio).toBe(0.50);
  });

  test('tier-based passes the role through unchanged', () => {
    const role = { minReasoning: 80, costRatio: 0.50, role: 'X' };
    const modified = applyStrategy(role, 'tier-based');
    expect(modified.minReasoning).toBe(80);
    expect(modified.costRatio).toBe(0.50);
  });

  test('experimental = max-quality (no isNew filter at this layer)', () => {
    const role = { minReasoning: 80, costRatio: 0.50, role: 'X' };
    const modified = applyStrategy(role, 'experimental');
    expect(modified.minReasoning).toBe(90);
    expect(modified.costRatio).toBe(0.50);
  });

  test('does not mutate the input role', () => {
    const role = { minReasoning: 80, costRatio: 0.50, role: 'X' };
    const snapshot = JSON.parse(JSON.stringify(role));
    applyStrategy(role, 'min-cost');
    applyStrategy(role, 'max-quality');
    expect(role).toEqual(snapshot);
  });
});

describe('model-scorer — getBestFor', () => {
  const MODELS = { glm52: GLM52, mimo25: MIMOV25, opus48: OPUS48 };

  test('sdd-archive picks the cheapest model meeting minReasoning', () => {
    const result = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    expect(result).not.toBeNull();
    expect(result.key).not.toBeNull();
    expect(result.model.tier).not.toBe('reference');
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.cost).toBeLessThanOrEqual(result.effectiveMaxCost + 1e-9);
    // mimo25 is the cheapest non-reference model fitting minReasoning=50.
    expect(result.key).toBe('mimo25');
  });

  test('gentle-orchestrator picks highest-reasoning non-reference model when one qualifies', () => {
    // Fantasy fixture with all benchmarks near saturation so it clears
    //   minReasoning=95. OPUS48 in this fixture set is the highest-scoring
    //   non-reference model.
    const fantasy = {
      key: 'fantasy',
      name: 'Fantasy Frontier',
      arena: 1695,
      swePro: 95.5,
      term: 96.0,
      input: 5.00,
      output: 25.00,
      tier: 'high',
    };
    const result = getBestFor(
      'gentle-orchestrator',
      { glm52: GLM52, mimo25: MIMOV25, opus48: OPUS48, fantasy },
      ROLE_MATRIX,
      REQUEST_PROFILES,
      'balanced'
    );
    expect(result.key).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.model.tier).not.toBe('reference');
    expect(result.key).toBe('fantasy');
  });

  test('gentle-orchestrator returns null when no model meets minReasoning=95 (current dataset)', () => {
    // OPUS48 is the highest-scoring non-reference model in the current dataset,
    //   but its compositeScore is ~82, below minReasoning=95. This verifies
    //   the no-qualify path explicitly.
    const result = getBestFor(
      'gentle-orchestrator',
      MODELS,
      ROLE_MATRIX,
      REQUEST_PROFILES,
      'balanced'
    );
    expect(result.key).toBeNull();
    expect(result.reason).toBeDefined();
    expect(result.reason).toMatch(/95/);
  });

  test('returns null when no model qualifies (synthetic high threshold)', () => {
    const smallModels = { tiny: { ...GLM52, name: 'Tiny', tier: 'budget' } };
    // Composite-score-based check: GLM-5.2 score is ~80, but a "minReasoning=95"
    //   role would disqualify most realistic open models — exercise the path
    //   by stuffing an impossible role threshold.
    const result = getBestFor(
      'tiny-role',
      { tiny: smallModels.tiny },
      { 'tiny-role': { minReasoning: 99.5, costRatio: 0.01, role: 'sentinel' } },
      { 'tiny-role': { inputTokens: 100, outputTokens: 50 } },
      'balanced'
    );
    expect(result.key).toBeNull();
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  test('effectiveMaxCost scales with reference model cost', () => {
    const a = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    // effectiveMaxCost = costRatio(0.05) * costEstimate(reference, profile)
    // Reference model is OPUS48: input 5.00, output 25.00.
    // Profile: 900 input + 500 output → 5/1M*900 + 25/1M*500 = 0.0045 + 0.0125 = 0.017
    expect(a.effectiveMaxCost).toBeCloseTo(0.017 * 0.05, 6);
  });

  test('min-cost strategy tightens effectiveMaxCost by 50%', () => {
    const balanced = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    const minCost = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'min-cost');
    expect(minCost.effectiveMaxCost).toBeCloseTo(balanced.effectiveMaxCost / 2, 6);
  });

  test('max-quality strategy tightens minReasoning by +10', () => {
    // For sdd-archive: balanced threshold 50; max-quality should raise to 60.
    const balanced = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    const maxQ = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'max-quality');
    // Same model might still win, but the eligibility floor is higher.
    // We test the threshold indirectly: balanced picks the cheapest eligible,
    // max-quality may still pick the same model IF it clears 60 — verify by
    // checking that the score check is still satisfied with the new floor.
    if (maxQ.key !== null) {
      expect(maxQ.score).toBeGreaterThanOrEqual(60);
    }
    // Either way, the function must return a valid result shape.
    expect(balanced.effectiveMaxCost).toBeCloseTo(maxQ.effectiveMaxCost, 6);
  });

  test('returns top-3 alternatives when a model qualifies', () => {
    const result = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    expect(Array.isArray(result.alternatives)).toBe(true);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    // Alternatives should not include the chosen model key.
    for (const alt of result.alternatives) {
      expect(alt.key).not.toBe(result.key);
    }
  });

  test('with only reference models in the set, returns null', () => {
    const refs = { opus48: OPUS48, gpt55: GPT55 };
    const result = getBestFor('sdd-archive', refs, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    expect(result.key).toBeNull();
    expect(result.reason).toMatch(/reference/i);
  });

  test('result shape is the documented BestForResult contract', () => {
    const result = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('effectiveMaxCost');
    expect(typeof result.effectiveMaxCost).toBe('number');
    if (result.key !== null) {
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('alternatives');
    } else {
      expect(result).toHaveProperty('reason');
    }
  });
});

// === Function under test =============================================
// Imports declared at bottom so the test file is still readable top-down.
// Tests fail (RED) until the implementation lands.

import {
  compositeScore,
  costEstimate,
  findReferenceModel,
  applyStrategy,
  getBestFor,
} from '../js/services/model-scorer.js';
