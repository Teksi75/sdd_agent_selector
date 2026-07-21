// tests/lifecycle.test.js
// Bounded work unit 2 — model lifecycle classification.
//
// Policy (user-approved):
//   - `active`: selector-eligible, main Composite ranking, Pricing views.
//   - `reference`, `legacy`, `benchmark-only`: NOT selector-eligible,
//     NOT in main Composite ranking, NOT in Pricing views.
//   - Non-active models remain visible in separated comparison/catalog.
//
// Backward compat: old/synthetic records without `lifecycle` derive it
// from `tier`/`isReference` (tier:reference or isReference:true → 'reference').

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

import {
  lifecycleOf,
  isActive,
  ACTIVE_LIFECYCLES,
  VALID_LIFECYCLES,
  compositeScore,
  findReferenceModel,
  getBestFor,
} from '../js/services/model-scorer.js';

// --- lifecycleOf ---------------------------------------------------------

describe('lifecycle — lifecycleOf()', () => {
  test('returns model.lifecycle when it is a valid value', () => {
    for (const lc of VALID_LIFECYCLES) {
      expect(lifecycleOf({ lifecycle: lc })).toBe(lc);
    }
  });

  test('returns "reference" for old record with tier:reference (backward compat)', () => {
    expect(lifecycleOf({ tier: 'reference' })).toBe('reference');
  });

  test('returns "reference" for old record with isReference:true (backward compat)', () => {
    expect(lifecycleOf({ isReference: true, tier: 'high' })).toBe('reference');
  });

  test('returns "active" for old record with no lifecycle and non-reference tier', () => {
    expect(lifecycleOf({ tier: 'high' })).toBe('active');
    expect(lifecycleOf({ tier: 'balanced' })).toBe('active');
    expect(lifecycleOf({ tier: 'budget' })).toBe('active');
  });

  test('returns "active" for a record with no tier and no lifecycle', () => {
    expect(lifecycleOf({})).toBe('active');
  });

  test('returns "active" for null/undefined input (defensive)', () => {
    expect(lifecycleOf(null)).toBe('active');
    expect(lifecycleOf(undefined)).toBe('active');
  });

  test('fails closed when lifecycle is explicitly present but invalid (non-string)', () => {
    expect(isActive({ lifecycle: 42, tier: 'high' })).toBe(false);
    expect(isActive({ lifecycle: true, tier: 'balanced' })).toBe(false);
  });

  test('fails closed when lifecycle is explicitly present but invalid string', () => {
    expect(isActive({ lifecycle: 'invalid', tier: 'high' })).toBe(false);
    expect(isActive({ lifecycle: 'deprecated' })).toBe(false);
  });

  test('does NOT derive reference from tier when lifecycle is explicitly invalid', () => {
    expect(lifecycleOf({ lifecycle: 'invalid', tier: 'reference' })).not.toBe('reference');
    expect(isActive({ lifecycle: 'invalid', tier: 'reference' })).toBe(false);
  });

  test('fails closed when lifecycle is explicitly null', () => {
    expect(isActive({ lifecycle: null, tier: 'high' })).toBe(false);
    expect(lifecycleOf({ lifecycle: null, tier: 'reference' })).toBe('legacy');
  });

  test('fails closed when lifecycle is explicitly undefined', () => {
    expect(isActive({ lifecycle: undefined, tier: 'high' })).toBe(false);
    expect(lifecycleOf({ lifecycle: undefined, tier: 'reference' })).toBe('legacy');
  });
});

// --- isActive ------------------------------------------------------------

describe('lifecycle — isActive()', () => {
  test('returns true only for active lifecycle', () => {
    expect(isActive({ lifecycle: 'active' })).toBe(true);
    expect(isActive({ lifecycle: 'reference' })).toBe(false);
    expect(isActive({ lifecycle: 'legacy' })).toBe(false);
    expect(isActive({ lifecycle: 'benchmark-only' })).toBe(false);
  });

  test('backward compat: tier:reference → not active', () => {
    expect(isActive({ tier: 'reference', isReference: true })).toBe(false);
  });

  test('backward compat: non-reference tier → active', () => {
    expect(isActive({ tier: 'high' })).toBe(true);
    expect(isActive({ tier: 'balanced' })).toBe(true);
    expect(isActive({ tier: 'budget' })).toBe(true);
  });
});

// --- ACTIVE_LIFECYCLES / VALID_LIFECYCLES --------------------------------

describe('lifecycle — constants', () => {
  test('ACTIVE_LIFECYCLES contains only "active"', () => {
    expect(ACTIVE_LIFECYCLES).toEqual(['active']);
  });

  test('VALID_LIFECYCLES contains exactly the 4 allowed values', () => {
    expect([...VALID_LIFECYCLES].sort()).toEqual([
      'active', 'benchmark-only', 'legacy', 'reference',
    ]);
  });
});

// --- getBestFor lifecycle integration ------------------------------------

describe('lifecycle — getBestFor excludes non-active models', () => {
  const ACTIVE_MODEL = {
    name: 'Active One',
    tier: 'high',
    lifecycle: 'active',
    input: 1,
    output: 3,
    benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
  };
  const LEGACY_MODEL = {
    name: 'Legacy One',
    tier: 'high',
    lifecycle: 'legacy',
    input: 0.5,
    output: 1.5,
    benchlm: { score: 85, verified: true, reliability: 0.9, categories: {} },
  };
  const REF_MODEL = {
    name: 'Ref One',
    tier: 'reference',
    lifecycle: 'reference',
    isReference: true,
    input: 5,
    output: 25,
    benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} },
  };
  const BENCHMARK_ONLY = {
    name: 'Bench Only',
    tier: 'high',
    lifecycle: 'benchmark-only',
    input: 0.1,
    output: 0.2,
    benchlm: { score: 99, verified: true, reliability: 0.99, categories: {} },
  };

  const MODELS = {
    active: ACTIVE_MODEL,
    legacy: LEGACY_MODEL,
    ref: REF_MODEL,
    benchOnly: BENCHMARK_ONLY,
  };

  const ROLE_MATRIX = {
    'test-agent': { minReasoning: 50, costRatio: 1.0, role: 'test' },
  };
  const PROFILES = {
    'test-agent': { inputTokens: 1000, outputTokens: 500 },
  };

  test('selects active model, ignoring legacy/reference/benchmark-only even with higher scores', () => {
    const result = getBestFor('test-agent', MODELS, ROLE_MATRIX, PROFILES, 'balanced');
    expect(result.key).toBe('active');
  });

  test('returns null when only non-active models exist', () => {
    const nonActive = { legacy: LEGACY_MODEL, ref: REF_MODEL, benchOnly: BENCHMARK_ONLY };
    const result = getBestFor('test-agent', nonActive, ROLE_MATRIX, PROFILES, 'balanced');
    expect(result.key).toBeNull();
    expect(result.reason).toMatch(/non-active|no .* eligible/i);
  });

  test('backward compat: old records without lifecycle field still work (tier:reference excluded)', () => {
    const oldRef = { name: 'Old Ref', tier: 'reference', isReference: true, input: 5, output: 25, benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} } };
    const oldActive = { name: 'Old Active', tier: 'high', input: 1, output: 3, benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} } };
    const result = getBestFor('test-agent', { oldRef, oldActive }, ROLE_MATRIX, PROFILES, 'balanced');
    expect(result.key).toBe('oldActive');
  });

  test('role-designated reference (referenceModelId) must NOT bypass active-only eligibility', () => {
    const refModel = {
      name: 'GPT-5.6 Terra',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      input: 5,
      output: 25,
      benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} },
    };
    const activeModel = {
      name: 'GLM-5.2',
      tier: 'high',
      lifecycle: 'active',
      input: 1,
      output: 3,
      benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
    };
    const models = { gpt56terra: refModel, glm52: activeModel };
    const roleMatrix = {
      'gentle-orchestrator': { minReasoning: 90, costRatio: 1.0, role: 'orchestrator', referenceModelId: 'gpt56terra' },
    };
    const profiles = {
      'gentle-orchestrator': { inputTokens: 1000, outputTokens: 500 },
    };
    const result = getBestFor('gentle-orchestrator', models, roleMatrix, profiles, 'balanced');
    expect(result.key).not.toBe('gpt56terra');
  });

  test('role-designated reference returns null when no active models exist', () => {
    const refModel = {
      name: 'Ref Only',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      input: 5,
      output: 25,
      benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} },
    };
    const models = { ref: refModel };
    const roleMatrix = {
      'test-agent': { minReasoning: 50, costRatio: 1.0, role: 'test', referenceModelId: 'ref' },
    };
    const profiles = { 'test-agent': { inputTokens: 1000, outputTokens: 500 } };
    const result = getBestFor('test-agent', models, roleMatrix, profiles, 'balanced');
    expect(result.key).toBeNull();
  });

  test('general soft fallback returns only active models', () => {
    const refModel = {
      name: 'Ref',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      input: 50,
      output: 100,
      benchlm: { score: 99, verified: true, reliability: 0.99, categories: {} },
    };
    const activeModel = {
      name: 'Active',
      tier: 'high',
      lifecycle: 'active',
      input: 1,
      output: 3,
      benchlm: { score: 40, verified: true, reliability: 0.9, categories: {} },
    };
    const models = { ref: refModel, active: activeModel };
    const roleMatrix = {
      'test-agent': { minReasoning: 90, costRatio: 1.0, role: 'test' },
    };
    const profiles = { 'test-agent': { inputTokens: 1000, outputTokens: 500 } };
    const result = getBestFor('test-agent', models, roleMatrix, profiles, 'balanced');
    expect(result.key).toBe('active');
    expect(result.softFallback).toBe(true);
  });

  test('omitted lifecycle: backward compat allows old active fixtures to be selected', () => {
    const oldActive = { name: 'Old', tier: 'high', input: 1, output: 3, benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} } };
    const models = { old: oldActive };
    const result = getBestFor('test-agent', models, ROLE_MATRIX, PROFILES, 'balanced');
    expect(result.key).toBe('old');
  });
});

// --- findReferenceModel lifecycle integration ----------------------------

describe('lifecycle — findReferenceModel with lifecycle field', () => {
  test('prefers lifecycle:reference models', () => {
    const models = {
      a: { lifecycle: 'active', tier: 'high', benchlm: { score: 80 } },
      b: { lifecycle: 'reference', tier: 'reference', isReference: true, benchlm: { score: 90 } },
    };
    const ref = findReferenceModel(models);
    expect(ref).toBe(models.b);
  });

  test('backward compat: tier:reference still recognized when lifecycle absent', () => {
    const models = {
      a: { tier: 'high', benchlm: { score: 80 } },
      b: { tier: 'reference', isReference: true, benchlm: { score: 90 } },
    };
    const ref = findReferenceModel(models);
    expect(ref).toBe(models.b);
  });
});

// --- data/models.json lifecycle validation -------------------------------

describe('lifecycle — data/models.json catalog classification', () => {
  const doc = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));
  const models = doc.models;

  test('every model has a valid lifecycle value', () => {
    for (const [key, m] of Object.entries(models)) {
      expect(
        VALID_LIFECYCLES.includes(m.lifecycle),
        `model ${key} has invalid lifecycle: ${m.lifecycle}`
      ).toBe(true);
    }
  });

  test('reference models: opus48, gpt55, gpt56terra, gpt56sol', () => {
    for (const key of ['opus48', 'gpt55', 'gpt56terra', 'gpt56sol']) {
      expect(models[key].lifecycle, `${key} should be reference`).toBe('reference');
    }
  });

  test('legacy models: glm5, glm51 (superseded GLM variants older than GLM-5.2)', () => {
    for (const key of ['glm5', 'glm51']) {
      expect(models[key].lifecycle, `${key} should be legacy`).toBe('legacy');
    }
  });

  test('GLM-5.2 is active', () => {
    expect(models.glm52.lifecycle).toBe('active');
  });

  test('non-reference, non-legacy models are active', () => {
    const expectedActive = [
      'glm52', 'qwen37max', 'minimaxm3', 'kimik27c', 'kimik3', 'kimik25',
      'kimik26', 'deepseekv4p', 'mimo25pro', 'qwen37plus', 'qwen36plus',
      'minimaxm27', 'mimo25', 'minimaxm25', 'deepseekv4f', 'gpt54',
      'claudeFable5', 'sonnet5', 'haiku45',
    ];
    for (const key of expectedActive) {
      expect(models[key].lifecycle, `${key} should be active`).toBe('active');
    }
  });

  test('no model in the current catalog uses benchmark-only (schema supports it but no member)', () => {
    const bmOnly = Object.entries(models).filter(([, m]) => m.lifecycle === 'benchmark-only');
    expect(bmOnly.length).toBe(0);
  });

  test('active model count is 19', () => {
    const activeCount = Object.values(models).filter((m) => m.lifecycle === 'active').length;
    expect(activeCount).toBe(19);
  });

  test('non-active count is 6 (4 reference + 2 legacy)', () => {
    const nonActive = Object.values(models).filter((m) => m.lifecycle !== 'active');
    expect(nonActive.length).toBe(6);
  });
});
