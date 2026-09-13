// tests/twin-judge.test.js
// Phase 1 — Verifies the twin-judge constraint mechanism.
//
// The constraint (spec "Twin Judge Constraint"): jd-judge-a and jd-judge-b
// MUST resolve to the SAME model key in any config selection. This prevents
// divergence between blind twin reviewers caused by model differences
// instead of code differences.
//
// In Phase 1 we don't yet have selectConfig() (Phase 2 deliverable). We
// instead verify the constraint at the getBestFor layer — and emulate
// what selectConfig will do in Phase 2 by checking that:
//
//   1. A synthetic dataset can be constructed where the two judges'
//      eligibility sets actually diverge.
//   2. getBestFor() honors that divergence (returns different keys for
//      jd-judge-a vs jd-judge-b).
//   3. A simulated "selectConfig" wrapper detects the divergence and
//      throws an InvalidConfigError when the keys disagree.
//
// This makes the constraint testable today AND pinpoints the failure mode
// that selectConfig must reject in Phase 2.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

import { getBestFor } from '../js/services/model-scorer.js';
import { applyProviderFilter } from '../js/services/provider-filter.js';

/**
 * Phase-2 placeholder — emulates what selectConfig() will do.
 * Returns assignments for all 18 agents and validates twin judge before returning.
 */
class InvalidConfigError extends Error {}

function selectConfigEmulator(strategy, models, roleMatrix, profiles) {
  const agents = Object.keys(roleMatrix);
  const assignments = {};
  for (const agent of agents) {
    const result = getBestFor(agent, models, roleMatrix, profiles, strategy);
    assignments[agent] = result;
  }
  // Twin judge constraint
  const a = assignments['jd-judge-a']?.key ?? null;
  const b = assignments['jd-judge-b']?.key ?? null;
  if (a !== b) {
    throw new InvalidConfigError(
      'jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)'
    );
  }
  return assignments;
}

describe('twin-judge constraint', () => {
  // Load the real role matrix and profiles from data/*.json.
  const roleMatrix = JSON.parse(
    readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8')
  ).roles;
  const profiles = JSON.parse(
    readFileSync(join(ROOT, 'data', 'agent-request-profiles.json'), 'utf-8')
  ).profiles;

  test('with current real data, jd-judge-a and jd-judge-b resolve identically', () => {
    // Sanity: the real dataset should be symmetric for the two judges.
    // (If they diverge here the real production data has a bug.)
    const models = JSON.parse(
      readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
    ).models;
    const a = getBestFor('jd-judge-a', models, roleMatrix, profiles, 'balanced');
    const b = getBestFor('jd-judge-b', models, roleMatrix, profiles, 'balanced');
    expect(a.key).toBe(b.key);
  });

  test('synthetic dataset forces jd-judge-a=X, jd-judge-b=Y (X != Y)', () => {
    // Construct a dataset where the two judges MUST diverge:
    //   judgeA prefers the premium model (wide cost allowance)
    //   judgeB prefers the budget model (tight cost allowance)
    // The role requirements differ on costRatio so each judge naturally
    //   picks a different model — the divergence scenario the constraint
    //   is designed to reject.
    //
    // PR3 fixture: each model carries a benchlm block so compositeScore
    // returns the expected deterministic score. The weights used here
    // reproduce the legacy fixture's intent:
    //   premium clears the minReasoning=90 floor with margin (94);
    //   budget also clears (91) but loses on cost.
    const premium = {
      name: 'Premium-A',
      benchlm: { score: 94, verified: true, reliability: 0.95, categories: {} },
      input: 5.00,
      output: 25.00,
      tier: 'high',
    };
    const budget = {
      name: 'Budget-B',
      benchlm: { score: 91, verified: true, reliability: 0.9, categories: {} },
      input: 0.10,
      output: 1.00,
      tier: 'balanced',
    };
    const matrixDiv = {
      'jd-judge-a': { minReasoning: 90, costRatio: 1.0, role: 'judge-a' },  // wide budget
      'jd-judge-b': { minReasoning: 90, costRatio: 0.10, role: 'judge-b' }, // tight budget
    };
    const profs = {
      'jd-judge-a': { inputTokens: 5500, outputTokens: 1200 },
      'jd-judge-b': { inputTokens: 5500, outputTokens: 1200 },
    };

    const rA = getBestFor('jd-judge-a', { premium, budget }, matrixDiv, profs, 'balanced');
    const rB = getBestFor('jd-judge-b', { premium, budget }, matrixDiv, profs, 'balanced');

    // Verify the divergence exists at the getBestFor layer.
    expect(rA.key).not.toBe(rB.key);
    // Premium should win for judgeA (costRatio allows it).
    expect(rA.key).toBe('premium');
    // Budget should win for judgeB (tight costRatio disqualifies premium).
    expect(rB.key).toBe('budget');
  });

  test('selectConfig emulator throws InvalidConfigError when twins diverge', () => {
    // Construct a manipulated dataset where the two judges MUST diverge.
    // PR3 fixture: benchlm blocks carry the deterministic scores that drive
    // the divergence scenario. judgeA_only = 95 (clears both 90 and 85
    // floors), judgeB_unique = 88 (clears 85 but costs out for judgeA).
    const judgeA_only = {
      name: 'JudgeA-Only',
      benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} },
      input: 5.00,
      output: 25.00,
      tier: 'high',
    };
    const judgeB_unique = {
      name: 'JudgeB-Unique',
      benchlm: { score: 88, verified: true, reliability: 0.92, categories: {} },
      input: 4.00,
      output: 20.00,
      tier: 'high',
    };

    // Approach: constrict the role/cost so A goes to one and B to the other.
    // jd-judge-a allows more cost → picks judgeA_only (premium).
    // jd-judge-b has tighter budget → picks judgeB_unique (cheaper).
    const matrixDiv = {
      'jd-judge-a': { minReasoning: 90, costRatio: 1.0, role: 'judge-a' }, // wide budget
      'jd-judge-b': { minReasoning: 85, costRatio: 0.30, role: 'judge-b' }, // tight budget
    };
    const profs = {
      'jd-judge-a': profiles['jd-judge-a'],
      'jd-judge-b': profiles['jd-judge-b'],
    };

    const rA = getBestFor('jd-judge-a', { a: judgeA_only, b: judgeB_unique }, matrixDiv, profs, 'balanced');
    const rB = getBestFor('jd-judge-b', { a: judgeA_only, b: judgeB_unique }, matrixDiv, profs, 'balanced');

    // Verify the divergence exists at the getBestFor layer:
    expect(rA.key).not.toBe(rB.key);

    // Now the emulator should throw when both are evaluated together.
    expect(() =>
      selectConfigEmulator('balanced', { a: judgeA_only, b: judgeB_unique }, matrixDiv, profs)
    ).toThrowError(InvalidConfigError);

    // Verify the specific error message text.
    try {
      selectConfigEmulator('balanced', { a: judgeA_only, b: judgeB_unique }, matrixDiv, profs);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidConfigError);
      expect(err.message).toBe(
        'jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)'
      );
    }
  });

  test('selectConfig emulator does NOT throw when twins resolve identically', () => {
    // With current real data the two judges pick the same model — confirm.
    const models = JSON.parse(
      readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
    ).models;
    expect(() =>
      selectConfigEmulator('balanced', models, roleMatrix, profiles)
    ).not.toThrow();
  });
});

// V5 Slice 3 — the twin invariant holds under provider filtering. Both judges
// MUST draw from the same eligible set; an empty eligible set yields two
// `key: null` results (normalized `unassigned`) and never throws.
describe('twin-judge — V5 Slice 3 filtered eligible set', () => {
  const availability = {
    ref: { p1: true, p2: true },
    shared: { p1: true, p2: true },
    p1only: { p1: true, p2: false },
    p2only: { p1: false, p2: true },
  };
  const models = {
    ref: { name: 'Ref', tier: 'reference', lifecycle: 'reference', benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} }, input: 5, output: 25 },
    shared: { name: 'Shared', tier: 'high', lifecycle: 'active', benchlm: { score: 85, verified: true, reliability: 0.9, categories: {} }, input: 4, output: 20 },
    p1only: { name: 'P1 Only', tier: 'balanced', lifecycle: 'active', benchlm: { score: 70, verified: true, reliability: 0.8, categories: {} }, input: 0.5, output: 1 },
    p2only: { name: 'P2 Only', tier: 'budget', lifecycle: 'active', benchlm: { score: 60, verified: false, reliability: 0.7, categories: {} }, input: 0.1, output: 0.2 },
  };
  const alignedMatrix = {
    'jd-judge-a': { minReasoning: 40, costRatio: 1.0, role: 'judge-a' },
    'jd-judge-b': { minReasoning: 40, costRatio: 1.0, role: 'judge-b' },
  };
  const profs = {
    'jd-judge-a': { inputTokens: 1000, outputTokens: 500 },
    'jd-judge-b': { inputTokens: 1000, outputTokens: 500 },
  };

  test('both judges draw from the same eligible reference and resolve identically', () => {
    const eligible = applyProviderFilter(models, availability, ['p1']);
    // The exclusive p2 model is NOT in the projected set.
    expect(Object.keys(eligible).sort()).toEqual(['p1only', 'ref', 'shared']);
    const a = getBestFor('jd-judge-a', eligible, alignedMatrix, profs, 'balanced');
    const b = getBestFor('jd-judge-b', eligible, alignedMatrix, profs, 'balanced');
    expect(a.key).toBe(b.key);
    expect(Object.keys(eligible)).toContain(a.key);
    expect(a.key).not.toBe('p2only');
  });

  test('divergence over a filtered fixture throws the exact message and mutates no DOM', async () => {
    const { render, setData, selectConfig, resetForTests, InvalidConfigError } =
      await import('../js/components/config-selector.js');
    resetForTests();
    const eligible = applyProviderFilter(models, availability, ['p1']);
    const divergentMatrix = {
      'jd-judge-a': { minReasoning: 40, costRatio: 1.0, role: 'judge-a' },
      // Judge B cannot afford ANY cost-clearing model → null vs shared.
      'jd-judge-b': { minReasoning: 99, costRatio: 0.0001, role: 'judge-b' },
    };
    const target = document.createElement('div');
    document.body.appendChild(target);
    setData({ models: eligible, roleMatrix: divergentMatrix, profiles: profs });
    render(target, [{ key: 'balanceado', name: 'Balanceado', strategy: 'balanced' }], () => {});
    let caught;
    try {
      selectConfig('balanceado');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidConfigError);
    expect(caught.message).toBe(
      'jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)'
    );
    // No DOM mutation: no button painted active.
    expect(target.querySelectorAll('button.active').length).toBe(0);
    target.remove();
  });

  test('empty eligible set yields key null for both (unassigned, no throw)', () => {
    const eligible = applyProviderFilter(models, availability, []);
    expect(Object.keys(eligible)).toHaveLength(0);
    const a = getBestFor('jd-judge-a', eligible, alignedMatrix, profs, 'balanced');
    const b = getBestFor('jd-judge-b', eligible, alignedMatrix, profs, 'balanced');
    expect(a.key).toBeNull();
    expect(b.key).toBeNull();
    // The twin gate normalizes both nulls to unassigned without throwing.
    expect(() => {
      const ea = a.key ?? null;
      const eb = b.key ?? null;
      if (ea !== eb) throw new Error('twin judge constraint violated');
    }).not.toThrow();
  });
});
