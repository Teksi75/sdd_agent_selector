// tests/provider-filter.test.js
// V5 slice 2 — shared provider predicate (tasks 2.1/2.2).
//
// Contract (delta spec "Hard Provider Filter — applyProviderFilter" + design
// "Predicado compartido"):
//   eligible(model) = enabledSet non-empty AND ∃ enabled provider with
//   availability[modelId][providerId] === true.
//   Missing map/key/unknown id/non-boolean → false (fail-closed).
//   Pure: returns a NEW object keyed by model id, preserves order + record
//   identity, never mutates its inputs, and never reads pricingSource/name/
//   tier/lifecycle.

import { describe, test, expect } from 'vitest';
import { applyProviderFilter, isModelAvailable } from '../js/services/provider-filter.js';

const availability = {
  shared: { 'opencode-go': true, 'chatgpt-plus': true, minimax: false },
  exclusiveA: { 'opencode-go': true, 'chatgpt-plus': false, minimax: false },
  exclusiveB: { 'opencode-go': false, 'chatgpt-plus': true, minimax: false },
  none: { 'opencode-go': false, 'chatgpt-plus': false, minimax: false },
  // `partial` deliberately lacks minimax — fail-closed on the missing key.
  partial: { 'opencode-go': true },
};

const catalog = {
  shared: { name: 'Shared', tier: 'high', lifecycle: 'active' },
  exclusiveA: { name: 'A', tier: 'budget', lifecycle: 'active' },
  exclusiveB: { name: 'B', tier: 'balanced', lifecycle: 'active' },
  none: { name: 'None', tier: 'high', lifecycle: 'active' },
  partial: { name: 'Partial', tier: 'high', lifecycle: 'active' },
};

describe('isModelAvailable — union of enabled subscriptions', () => {
  test('true when ANY enabled provider explicitly grants the model', () => {
    expect(isModelAvailable(availability.shared, ['chatgpt-plus'])).toBe(true);
    expect(isModelAvailable(availability.exclusiveA, ['opencode-go'])).toBe(true);
  });

  test('empty enabledSet, missing map, missing key, unknown id and non-boolean → false', () => {
    expect(isModelAvailable(availability.shared, [])).toBe(false);
    expect(isModelAvailable(undefined, ['opencode-go'])).toBe(false);
    expect(isModelAvailable(availability.shared, ['unknown-provider'])).toBe(false);
    expect(isModelAvailable({ 'opencode-go': 'true' }, ['opencode-go'])).toBe(false);
    expect(isModelAvailable({ 'opencode-go': 1 }, ['opencode-go'])).toBe(false);
  });

  test('pricingSource/name/tier/lifecycle never affect eligibility', () => {
    const noisy = {
      'opencode-go': true,
      pricingSource: 'artificialanalysis',
      name: 'GLM-5.2',
      tier: 'reference',
      lifecycle: 'legacy',
    };
    expect(isModelAvailable(noisy, ['opencode-go'])).toBe(true);
  });
});

describe('applyProviderFilter — eligible projection', () => {
  test('keeps only models granted by an enabled provider, preserving order + identity', () => {
    const result = applyProviderFilter(catalog, availability, ['opencode-go']);
    expect(Object.keys(result)).toEqual(['shared', 'exclusiveA', 'partial']);
    expect(result.shared).toBe(catalog.shared);
    expect(result.none).toBeUndefined();
    expect(result.exclusiveB).toBeUndefined();
  });

  test('shared model survives when one of its two providers is toggled off', () => {
    const onlyB = applyProviderFilter(catalog, availability, ['chatgpt-plus']);
    expect(Object.keys(onlyB)).toEqual(['shared', 'exclusiveB']);
    expect(onlyB.shared).toBe(catalog.shared);
  });

  test('empty enabledSet → empty projection', () => {
    const result = applyProviderFilter(catalog, availability, []);
    expect(Object.keys(result)).toEqual([]);
  });

  test('missing availability entry (unknown/new model) is excluded fail-closed', () => {
    const result = applyProviderFilter({ ghost: { name: 'Ghost' } }, availability, ['opencode-go']);
    expect(result.ghost).toBeUndefined();
  });

  test('returns a new object and does not mutate deep-frozen inputs', () => {
    const frozenCatalog = Object.freeze({
      shared: Object.freeze({ ...catalog.shared }),
      exclusiveA: Object.freeze({ ...catalog.exclusiveA }),
    });
    const frozenAvailability = Object.freeze({ shared: Object.freeze({ 'opencode-go': true }) });
    const result = applyProviderFilter(frozenCatalog, frozenAvailability, ['opencode-go']);
    expect(result).not.toBe(frozenCatalog);
    expect(result.shared.name).toBe('Shared');
    expect(Object.keys(result)).toEqual(['shared']);
  });
});
