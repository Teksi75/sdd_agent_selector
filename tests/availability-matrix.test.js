// @vitest-environment node
// tests/availability-matrix.test.js
// V5 build gate — full `families × providers` availability matrix over
// `data/models.json` + `data/providers.json` (design "Availability
// materializada"). Missing cell => unavailable (fail-closed) AND the build
// fails loud naming the `(family, provider)` cell so absence never ships
// quietly. `pricingSource` is orthogonal and MUST NOT be consulted.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { familyKey, missingMatrixCells, propagate } from '../scripts/propagate-provider-availability.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const doc = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));
const models = doc.models;
const providerIds = JSON.parse(readFileSync(join(ROOT, 'data', 'providers.json'), 'utf-8'))
  .providers.map((p) => p.id);

describe('availability matrix gate — curated catalog (schema 5)', () => {
  test('models schema is 5 and the full matrix has zero missing/invalid cells', () => {
    expect(doc._meta.schemaVersion).toBe(5);
    expect(missingMatrixCells(models, providerIds)).toEqual([]);
  });

  test('every record carries exactly the registry ids as booleans', () => {
    const expectedKeys = [...providerIds].sort();
    const ids = Object.keys(models);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const map = models[id].availability;
      expect(map, `${id}.availability must exist`).toBeDefined();
      expect(Object.keys(map).sort(), `${id}.availability key set`).toEqual(expectedKeys);
      for (const [provider, value] of Object.entries(map)) {
        expect(typeof value, `${id}.availability.${provider} must be boolean`).toBe('boolean');
      }
    }
  });

  test('base families are curated and every active family has at least one confirmed provider', () => {
    const bases = Object.keys(models).filter((id) => familyKey(id, models) === id);
    expect(bases.length).toBeGreaterThan(0);
    const unconfirmed = [];
    for (const base of bases) {
      const map = models[base].availability;
      expect(Object.keys(map).sort()).toEqual([...providerIds].sort());
      if (models[base].lifecycle === 'active' && !Object.values(map).some(Boolean)) {
        unconfirmed.push(base);
      }
    }
    expect(unconfirmed, 'active families without a single confirmed provider').toEqual([]);
  });

  test('meta curation: only the Muse Spark base families are available on Meta', () => {
    const bases = Object.keys(models).filter((id) => familyKey(id, models) === id);
    expect(bases.length).toBeGreaterThan(0);
    // Fail-closed: every base declares the column explicitly, and exactly the
    // two curated Muse Spark families are `true`.
    const metaTrue = bases.filter((base) => models[base].availability?.meta === true);
    expect(metaTrue.sort()).toEqual(['musespark12contributor', 'musespark13contributor']);
    const nonBoolean = bases.filter(
      (base) => typeof models[base].availability?.meta !== 'boolean'
    );
    expect(nonBoolean, 'base families without an explicit meta boolean').toEqual([]);
    const metaFalse = bases.filter((base) => models[base].availability?.meta === false);
    expect(metaFalse.length).toBe(bases.length - metaTrue.length);
  });

  test('effort variants resolve the identical base-family map (no overrides declared)', () => {
    expect(doc._meta.availabilityOverrides ?? []).toEqual([]);
    let variants = 0;
    for (const id of Object.keys(models)) {
      const family = familyKey(id, models);
      if (family === id) continue;
      expect(models[id].availability, `${id} must inherit ${family}`).toEqual(models[family].availability);
      variants++;
    }
    expect(variants).toBeGreaterThan(0);
  });
});

describe('availability matrix gate — cell-level failures', () => {
  const fixture = () => ({
    foo: { lifecycle: 'active', availability: { p1: true, p2: false } },
    fooHigh: { lifecycle: 'active', availability: { p1: true } },
  });

  test('a missing (family, provider) cell is reported by name', () => {
    const problems = missingMatrixCells(fixture(), ['p1', 'p2']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ id: 'fooHigh', family: 'foo', provider: 'p2' });
  });

  test('a map with an unknown provider key is reported, not silently accepted', () => {
    const problemFixture = fixture();
    problemFixture.fooHigh.availability = { p1: true, p2: false, ghost: true };
    const problems = missingMatrixCells(problemFixture, ['p1', 'p2']);
    expect(problems.filter((p) => p.provider === 'ghost')).toHaveLength(1);
  });

  test('pricingSource is never consulted: mutating it leaves propagation output identical', () => {
    const withSource = () => ({
      foo: { pricingSource: 'artificialanalysis', availability: { p1: true, p2: false } },
      fooHigh: { pricingSource: 'artificialanalysis', availability: { p1: true, p2: false } },
    });
    // Eligibility is fully described by the availability map: pricingSource
    // must not enter the derivation, so only the maps are compared.
    const mapsOf = (records) =>
      Object.fromEntries(Object.entries(records).map(([id, record]) => [id, record.availability]));
    const before = mapsOf(propagate(withSource(), ['p1', 'p2'], []).models);
    const mutated = withSource();
    mutated.foo.pricingSource = 'unknown';
    delete mutated.fooHigh.pricingSource;
    const after = mapsOf(propagate(mutated, ['p1', 'p2'], []).models);
    expect(after).toEqual(before);
  });
});
