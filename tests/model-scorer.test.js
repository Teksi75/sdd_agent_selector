// tests/model-scorer.test.js
// PR3 (benchlm-replace-custom-scoring) — model-scorer TDD.
//
// After PR3, `compositeScore(model)` MUST return `model.benchlm.score`
// clamped to [0, 100], null when BenchLM data is missing/NaN. The
// 4-benchmark weighted-average math is GONE — see spec scenario
// `benchlm-score-contract` and design "compositeScore Reimplementation".
//
// Existing fixtures (Phase 1) kept the legacy arena/swePro/sweVer/term
// fields. Each fixture now also carries a representative `benchlm` block
// so downstream tests (findReferenceModel, getBestFor, soft fallback)
// still produce deterministic numbers under the new contract.
//
// Coverage target: model-scorer.js ≥ 80% lines/functions/statements.

import { describe, test, expect, vi } from 'vitest';

// --- Fixtures ----------------------------------------------------------
//
// Each fixture pairs the legacy 4-benchmark fields (still present in
// data/models.json for the open-Pipelines reference) with a `benchlm`
// block that matches what PR2's scrape-benchlm would write for that
// model. The benchlm block is what `compositeScore` actually reads in
// PR3 — legacy fields become inert at PR3 merge.

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
  benchlm: { score: 79.4, verified: true, reliability: 0.92, categories: {} },
};

const MIMOV25 = {
  key: 'mimo25',
  name: 'MiMo V2.5',
  arena: 1435,
  input: 0.14,
  output: 0.28,
  cacheRead: 0.0028,
  tier: 'budget',
  benchlm: { score: 87.0, verified: true, reliability: 0.88, categories: {} },
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
  benchlm: { score: 92.0, verified: true, reliability: 0.95, categories: {} },
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
  benchlm: { score: 96.0, verified: true, reliability: 0.97, categories: {} },
};

// A model with NO `benchlm` block — exercises the null sentinel path.
// Pre-PR1 models still look like this until the first scrape-benchlm
// cron lands. The readers (chart, model-card, ref-table) MUST render
// these as "unavailable" — `compositeScore` returns `null`.
const NO_BENCHLM = {
  key: 'noBench',
  name: 'No BenchLM',
  arena: 1500,
  input: 1.00,
  output: 3.00,
  tier: 'balanced',
  // benchlm key ABSENT — not present at all.
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

// === compositeScore — PR3 contract (benchlm-score-contract) ===========
//
// Replaces the 4-benchmark weighted average with `benchlm.score` direct.
// Spec scenarios:
//   - "Tracked model"   benchlm.score = 78.3 → returns 78.3
//   - "Missing data"    no benchlm key     → returns null  (NOT 0)

describe('model-scorer — compositeScore (PR3 benchlm contract)', () => {
  test('(a) returns benchlm.score directly when present and finite', () => {
    const m = { benchlm: { score: 78.3, verified: true, reliability: 0.9, categories: {} } };
    expect(compositeScore(m)).toBe(78.3);
  });

  test('(b) returns null when benchlm.score is null (NOT 0)', () => {
    const m = { benchlm: { score: null, verified: false, reliability: 0, categories: {} } };
    expect(compositeScore(m)).toBeNull();
    // Critical: must NOT be 0 (which would render as a stale zero bar).
    expect(compositeScore(m)).not.toBe(0);
  });

  test('(c) returns null when benchlm block is absent', () => {
    // Spec "Missing data returns null" — the model has no benchlm key at all
    // (pre-PR1 backfill state, or a model BenchLM never published).
    expect(compositeScore(NO_BENCHLM)).toBeNull();
    // And returns null for an empty object too.
    expect(compositeScore({})).toBeNull();
  });

  test('(d) returns null when benchlm.score is NaN', () => {
    const m = { benchlm: { score: NaN, verified: true, reliability: 0.9, categories: {} } };
    expect(compositeScore(m)).toBeNull();
  });

  test('(e) clamps benchlm.score above 100 down to 100', () => {
    const m = { benchlm: { score: 150, verified: true, reliability: 0.9, categories: {} } };
    expect(compositeScore(m)).toBe(100);
  });

  test('(f) clamps benchlm.score below 0 up to 0', () => {
    const m = { benchlm: { score: -10, verified: true, reliability: 0.9, categories: {} } };
    expect(compositeScore(m)).toBe(0);
  });

  test('(g) is pure (same input → same output; no global state)', () => {
    const spy = vi.fn(() => compositeScore);
    const m = { benchlm: { score: 42.5, verified: true, reliability: 0.9, categories: {} } };
    const r1 = compositeScore(m);
    const r2 = compositeScore(m);
    expect(r1).toBe(r2);
    expect(r1).toBe(42.5);
    // compositeScore must not have any side effects on the input.
    expect(m.benchlm.score).toBe(42.5);
    spy.mockRestore();
  });

  test('also returns null when model itself is null/undefined/non-object', () => {
    // Defensive: in production a stale cache or bad merge might surface
    // a missing/garbage model row. compositeScore must NEVER throw.
    expect(compositeScore(null)).toBeNull();
    expect(compositeScore(undefined)).toBeNull();
    expect(compositeScore('not-an-object')).toBeNull();
    expect(compositeScore(42)).toBeNull();
  });

  test('score is bounded in [0, 100] for every realistic fixture', () => {
    // Fixtures carry benchlm blocks in spec range; compositeScore should
    // never return >100 or <0 against them.
    for (const m of [GLM52, MIMOV25, OPUS48, GPT55]) {
      const s = compositeScore(m);
      expect(s).not.toBeNull();
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  test('returns null when model exists but benchlm is missing the score sub-field', () => {
    const m = { benchlm: { verified: true, reliability: 0.9, categories: {} } };
    expect(compositeScore(m)).toBeNull();
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
    const cost = costEstimate(MIMOV25);
    expect(cost).toBeCloseTo(0.00028, 6);
  });

  test('custom profile (5000+2000) on GLM-5.2 → ~0.0158', () => {
    const cost = costEstimate(GLM52, { inputTokens: 5000, outputTokens: 2000 });
    expect(cost).toBeCloseTo(0.0158, 4);
  });

  test('asymmetric read-only (5000+1000) matches linear scaling', () => {
    const a = costEstimate(GLM52, { inputTokens: 5000, outputTokens: 1000 });
    const b = costEstimate(GLM52, { inputTokens: 1000, outputTokens: 5000 });
    expect(a).toBeLessThan(b);
  });

  test('cost scales linearly with inputTokens (at constant outputTokens)', () => {
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
    expect(ref).not.toBeNull();
    expect(ref.tier).toBe('reference');
    expect(ref.isReference).toBe(true);
  });

  test('falls back to highest compositeScore when no reference tier', () => {
    // Pool without tier:reference; MIMOV25 has benchlm.score=87, GLM52 has
    // 79.4 — MIMOV25 wins.
    const ref = findReferenceModel({
      glm52: GLM52,
      mimo25: MIMOV25,
    });
    expect(ref).not.toBeNull();
    expect(ref.tier).not.toBe('reference');
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

  test('preserves opt-in fields like referenceModelId across every strategy', () => {
    const role = { minReasoning: 80, costRatio: 0.50, role: 'X', referenceModelId: 'gpt55' };
    for (const strat of ['min-cost', 'balanced', 'max-quality', 'tier-based', 'experimental']) {
      const modified = applyStrategy(role, strat);
      expect(modified.referenceModelId, `strategy ${strat} dropped referenceModelId`).toBe('gpt55');
    }
  });
});

describe('model-scorer — getBestFor', () => {
  const MODELS = { glm52: GLM52, mimo25: MIMOV25, opus48: OPUS48 };

  test('sdd-archive picks the cheapest model meeting minReasoning', () => {
    // mimo25.benchlm.score=87 ≥ minReasoning(50), cheapest.
    // glm52.benchlm.score=79.4 ≥ 50, more expensive than mimo25.
    // OPUS48 is tier:reference → excluded.
    const result = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    expect(result).not.toBeNull();
    expect(result.key).not.toBeNull();
    expect(result.model.tier).not.toBe('reference');
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.cost).toBeLessThanOrEqual(result.effectiveMaxCost + 1e-9);
    expect(result.key).toBe('mimo25');
  });

  test('gentle-orchestrator picks highest-reasoning non-reference model when one qualifies', () => {
    // Fantasy fixture carries a benchlm.score high enough to clear the 95
    // floor. We deliberately give it no legacy benchmarks — the test name
    // shifts focus to benchlm-only scoring under PR3.
    const fantasy = {
      key: 'fantasy',
      name: 'Fantasy Frontier',
      arena: 1695,
      swePro: 95.5,
      term: 96.0,
      input: 5.00,
      output: 25.00,
      tier: 'high',
      benchlm: { score: 98.0, verified: true, reliability: 0.96, categories: {} },
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

  test('gentle-orchestrator: no non-reference fixture clears 95 → soft fallback to mimo25', () => {
    // Under PR3, no model in MODELS has benchlm.score ≥ 95. The
    // general soft-fallback path surfaces the highest-scoring
    // cost-clearing non-reference model (MIMOV25, score=87) as a soft
    // fallback instead of returning null.
    const result = getBestFor(
      'gentle-orchestrator',
      MODELS,
      ROLE_MATRIX,
      REQUEST_PROFILES,
      'balanced'
    );
    expect(result.key).not.toBeNull();
    expect(result.softFallback).toBe(true);
    expect(result.reason).toMatch(/soft fallback/i);
    expect(result.reason).toMatch(/minReasoning=95/);
    expect(result.cost).toBeLessThanOrEqual(result.effectiveMaxCost + 1e-9);
  });

  test('returns null when no model qualifies (synthetic high threshold)', () => {
    const smallModels = {
      tiny: {
        key: 'tiny',
        name: 'Tiny',
        tier: 'budget',
        arena: 1500,
        input: 1,
        output: 3,
        benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
      },
    };
    const result = getBestFor(
      'tiny-role',
      smallModels,
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
    // OPUS48: input 5.00, output 25.00.
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
    if (maxQ.key !== null) {
      expect(maxQ.score).toBeGreaterThanOrEqual(60);
    }
    expect(balanced.effectiveMaxCost).toBeCloseTo(maxQ.effectiveMaxCost, 6);
  });

  test('returns top-3 alternatives when a model qualifies', () => {
    const result = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, REQUEST_PROFILES, 'balanced');
    expect(Array.isArray(result.alternatives)).toBe(true);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
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

// === Soft fallback (no eligible, no role-designated reference) ============

describe('model-scorer — getBestFor soft fallback (general)', () => {
  const FANTASY_REF = {
    key: 'ref',
    name: 'Reference Frontier',
    arena: 1700,
    swePro: 95,
    term: 95,
    input: 5,
    output: 25,
    tier: 'reference',
    isReference: true,
    benchlm: { score: 99.0, verified: true, reliability: 0.95, categories: {} },
  };
  // benchlm.score 77 < max-quality floor 80 → triggers soft fallback path.
  const STRONG_NONREF = {
    key: 'strong',
    name: 'Strong NonRef',
    arena: 1600,
    swePro: 60,
    term: 70,
    input: 1,
    output: 2,
    tier: 'high',
    benchlm: { score: 77.0, verified: true, reliability: 0.9, categories: {} },
  };
  // benchlm.score 55 → cheap but dumb; loses to STRONG in soft fallback.
  const WEAK_NONREF = {
    key: 'weak',
    name: 'Weak NonRef',
    arena: 1400,
    swePro: 50,
    term: 50,
    input: 1,
    output: 2,
    tier: 'balanced',
    benchlm: { score: 55.0, verified: false, reliability: 0.6, categories: {} },
  };
  const SOFT_POOL = { ref: FANTASY_REF, strong: STRONG_NONREF, weak: WEAK_NONREF };

  const HIGH_REASONING_ROLE = {
    'sdd-architect': { minReasoning: 70, costRatio: 0.80, role: 'design' },
  };
  const HIGH_REASONING_PROFILES = {
    'sdd-architect': { inputTokens: 3000, outputTokens: 2000 },
  };

  test('returns soft-fallback model when reasoning floor is unreachable but cost clears', () => {
    const result = getBestFor(
      'sdd-architect',
      SOFT_POOL,
      HIGH_REASONING_ROLE,
      HIGH_REASONING_PROFILES,
      'max-quality'
    );
    expect(result.key).not.toBeNull();
    expect(result.softFallback).toBe(true);
    expect(result.reason).toMatch(/soft fallback/i);
    expect(result.reason).toMatch(/minReasoning=80/);
  });

  test('soft fallback picks the highest-scoring cost-clearing model', () => {
    const result = getBestFor(
      'sdd-architect',
      SOFT_POOL,
      HIGH_REASONING_ROLE,
      HIGH_REASONING_PROFILES,
      'max-quality'
    );
    expect(result.key).toBe('strong');
  });

  test('soft fallback result includes the standard model/score/cost/effectiveMaxCost fields', () => {
    const result = getBestFor(
      'sdd-architect',
      SOFT_POOL,
      HIGH_REASONING_ROLE,
      HIGH_REASONING_PROFILES,
      'max-quality'
    );
    expect(result.model).toBeDefined();
    expect(result.model.tier).not.toBe('reference');
    expect(typeof result.score).toBe('number');
    expect(typeof result.cost).toBe('number');
    expect(result.cost).toBeLessThanOrEqual(result.effectiveMaxCost + 1e-9);
    expect(typeof result.effectiveMaxCost).toBe('number');
  });

  test('soft fallback includes up to 3 alternatives from cost-clearing pool', () => {
    const result = getBestFor(
      'sdd-architect',
      SOFT_POOL,
      HIGH_REASONING_ROLE,
      HIGH_REASONING_PROFILES,
      'max-quality'
    );
    expect(Array.isArray(result.alternatives)).toBe(true);
    expect(result.alternatives.length).toBeLessThanOrEqual(1);
    for (const alt of result.alternatives) {
      expect(alt.key).not.toBe(result.key);
    }
  });

  test('returns null when NO non-reference model clears the cost ceiling', () => {
    const TINY_ROLE = {
      'tiny-role': { minReasoning: 50, costRatio: 0.0001, role: 'tiny' },
    };
    const TINY_PROFILES = { 'tiny-role': { inputTokens: 100, outputTokens: 50 } };
    const result = getBestFor('tiny-role', SOFT_POOL, TINY_ROLE, TINY_PROFILES, 'balanced');
    expect(result.key).toBeNull();
    expect(result.softFallback).toBeUndefined();
    expect(typeof result.reason).toBe('string');
  });

  test('soft fallback is NOT triggered when a normal eligible model exists', () => {
    const result = getBestFor(
      'sdd-architect',
      SOFT_POOL,
      HIGH_REASONING_ROLE,
      HIGH_REASONING_PROFILES,
      'balanced'
    );
    if (result.key !== null) {
      expect(result.softFallback).toBeFalsy();
    }
  });

  test('soft fallback DOES NOT surface reference-tier models (filtered out)', () => {
    const REF_ONLY_POOL = { ref: FANTASY_REF, weak: WEAK_NONREF };
    const result = getBestFor(
      'sdd-architect',
      REF_ONLY_POOL,
      HIGH_REASONING_ROLE,
      HIGH_REASONING_PROFILES,
      'max-quality'
    );
    if (result.key !== null) {
      expect(result.key).not.toBe('ref');
      expect(result.model.tier).not.toBe('reference');
    }
  });
});

// === Role-designated soft fallback (referenceModelId) ==================

describe('model-scorer — role-designated reference soft fallback', () => {
  const ORCH_REF = {
    key: 'orch-ref',
    name: 'Orch Reference',
    arena: 2200,
    swePro: 58.6,
    term: 84.3,
    input: 2.5,
    output: 15,
    cacheRead: 0.25,
    tier: 'reference',
    isReference: true,
    benchlm: { score: 95.0, verified: true, reliability: 0.95, categories: {} },
  };
  const CHEAP = {
    key: 'cheap',
    name: 'Cheap NonRef',
    arena: 1500,
    input: 0.3,
    output: 1.2,
    cacheRead: 0.06,
    tier: 'balanced',
    benchlm: { score: 65.0, verified: false, reliability: 0.7, categories: {} },
  };
  const POOL = { 'orch-ref': ORCH_REF, cheap: CHEAP };

  const ORCH_ROLE = {
    'gentle-orchestrator': {
      minReasoning: 95,
      costRatio: 1.0,
      referenceModelId: 'orch-ref',
      role: 'orchestration',
    },
  };
  const ORCH_PROFILES = {
    'gentle-orchestrator': { inputTokens: 4000, outputTokens: 2000 },
  };

  test('role-designated reference is surfaced when no normal eligible model exists', () => {
    const result = getBestFor('gentle-orchestrator', POOL, ORCH_ROLE, ORCH_PROFILES, 'balanced');
    expect(result.key).toBe('orch-ref');
    expect(result.softFallback).toBe(true);
    expect(result.reason).toMatch(/role-designated reference/);
    expect(result.reason).toMatch(/orch-ref/);
    expect(result.cost).toBeLessThanOrEqual(result.effectiveMaxCost + 1e-9);
  });

  test('falls through to general soft fallback if role-designated reference is too expensive', () => {
    const TIGHT_ROLE = {
      'gentle-orchestrator': {
        minReasoning: 95,
        costRatio: 0.001,
        referenceModelId: 'orch-ref',
        role: 'orchestration',
      },
    };
    const result = getBestFor('gentle-orchestrator', POOL, TIGHT_ROLE, ORCH_PROFILES, 'balanced');
    expect(result.key).not.toBe('orch-ref');
    expect(result.reason).not.toMatch(/role-designated reference/);
  });

  test('falls through to general soft fallback if referenceModelId is missing from pool', () => {
    const MISSING_ROLE = {
      'gentle-orchestrator': {
        minReasoning: 95,
        costRatio: 1.0,
        referenceModelId: 'nonexistent',
        role: 'orchestration',
      },
    };
    const result = getBestFor('gentle-orchestrator', POOL, MISSING_ROLE, ORCH_PROFILES, 'balanced');
    expect(result.key).not.toBe('nonexistent');
    expect(result.reason).not.toMatch(/role-designated reference/);
  });
});

// === Imports ===========================================================
// Imports declared at the bottom so the test file is still readable top-down.

import {
  compositeScore,
  costEstimate,
  findReferenceModel,
  applyStrategy,
  getBestFor,
} from '../js/services/model-scorer.js';
