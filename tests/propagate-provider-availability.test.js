// @vitest-environment node
// tests/propagate-provider-availability.test.js
// V5 authoring pass contract — `scripts/propagate-provider-availability.mjs`.
// Humans curate only base families; variants inherit mechanically. An exact-id
// map survives ONLY when declared in `_meta.availabilityOverrides` and is
// always reported. Undeclared override, stale override, or a variant whose
// base map is invalid MUST fail with the offending id (non-zero exit).

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { familyKey, propagate, serializeModels } from '../scripts/propagate-provider-availability.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'propagate-provider-availability.mjs');
const P = ['p1', 'p2'];
const BASE_MAP = { p1: true, p2: false };
const OTHER_MAP = { p1: false, p2: true };

const rec = (availability, extra = {}) => ({
  name: 'model',
  tier: 'high',
  lifecycle: 'active',
  availability,
  ...extra,
});

describe('familyKey — one known suffix, case-sensitive, base must exist', () => {
  const models = {
    foo: rec(BASE_MAP),
    fooXhigh: rec(BASE_MAP),
    fooXhighHigh: rec(BASE_MAP),
  };

  test('strips exactly one suffix when the base record exists', () => {
    expect(familyKey('fooXhigh', models)).toBe('foo');
    expect(familyKey('fooNonReasoning', models)).toBe('foo');
    expect(familyKey('fooXhighHigh', models)).toBe('fooXhigh');
  });

  test('an id without a base record is its own family (no guessing)', () => {
    expect(familyKey('barHigh', models)).toBe('barHigh');
    expect(familyKey('bazMedium', models)).toBe('bazMedium');
  });

  test('suffix matching is case-sensitive', () => {
    expect(familyKey('foohigh', models)).toBe('foohigh');
    expect(familyKey('fooHIGH', models)).toBe('fooHIGH');
  });
});

describe('propagate — deterministic inheritance and override reporting', () => {
  test('clones the base map into every variant record', () => {
    const models = {
      foo: rec(BASE_MAP),
      fooHigh: rec(BASE_MAP),
      fooLow: { name: 'model', tier: 'high', lifecycle: 'active' },
    };
    const { models: next, errors, honored } = propagate(models, P, []);
    expect(errors).toEqual([]);
    expect(honored).toEqual([]);
    expect(next.fooHigh.availability).toEqual(BASE_MAP);
    expect(next.fooLow.availability).toEqual(BASE_MAP);
  });

  test('an exact-id override survives only when declared, and is reported', () => {
    const models = { foo: rec(BASE_MAP), fooHigh: rec(OTHER_MAP) };

    const undeclared = propagate(models, P, []);
    expect(undeclared.errors).toHaveLength(1);
    expect(undeclared.errors[0]).toMatchObject({ kind: 'undeclared-override', id: 'fooHigh' });

    const declared = propagate(models, P, ['fooHigh']);
    expect(declared.errors).toEqual([]);
    expect(declared.honored).toEqual(['fooHigh']);
    expect(declared.models.fooHigh.availability).toEqual(OTHER_MAP);
  });

  test('a stale override (unknown id) fails naming the offending id', () => {
    const models = { foo: rec(BASE_MAP), fooHigh: rec(BASE_MAP) };
    const { errors } = propagate(models, P, ['fooGhost']);
    expect(errors.some((e) => e.kind === 'stale-override' && e.id === 'fooGhost')).toBe(true);

    const { errors: nonVariant } = propagate(models, P, ['foo']);
    expect(nonVariant.some((e) => e.kind === 'stale-override' && e.id === 'foo')).toBe(true);
  });

  test('a variant whose base family has no valid map fails naming the variant', () => {
    const models = { foo: { name: 'foo' }, fooHigh: rec(BASE_MAP) };
    const { errors } = propagate(models, P, []);
    expect(errors.some((e) => e.kind === 'base-missing-map' && e.id === 'foo')).toBe(true);
    expect(errors.some((e) => e.kind === 'variant-without-base' && e.id === 'fooHigh')).toBe(true);
  });

  test('materialization keeps availability as the first property of every record', () => {
    const models = { foo: rec(BASE_MAP, {}), fooHigh: rec(BASE_MAP) };
    const { models: next } = propagate(models, P, []);
    expect(Object.keys(next.fooHigh)[0]).toBe('availability');
    expect(Object.keys(next.foo).slice(0, 2)).toEqual(['availability', 'name']);
  });

  test('serializeModels keeps every availability map on one line and round-trips', () => {
    const doc = {
      _meta: { schemaVersion: 5 },
      models: {
        foo: { name: 'foo', tier: 'high', availability: BASE_MAP },
        fooHigh: { name: 'foo', tier: 'high', availability: OTHER_MAP },
      },
    };
    const out = serializeModels(doc);
    expect(out).toContain('"availability": { "p1": true, "p2": false }');
    expect(out).toContain('"availability": { "p1": false, "p2": true }');
    // Exactly one physical line per availability map (design: compact maps).
    const availabilityLines = out.split('\n').filter((line) => line.includes('"availability"'));
    expect(availabilityLines).toHaveLength(2);
    expect(availabilityLines.every((line) => line.trim().endsWith('},') || line.trim().endsWith('}'))).toBe(true);
    expect(out.endsWith('\n')).toBe(true);
    expect(JSON.parse(out)).toEqual(doc);
  });
});

describe('propagate CLI — non-zero exit with the offending id', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fsImpl.mkdtempSync(join(tmpdir(), 'propagate-availability-'));
  });
  afterEach(() => {
    fsImpl.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('an invalid fixture exits non-zero and never writes the file', () => {
    const file = join(tmpDir, 'models.json');
    const doc = {
      _meta: { schemaVersion: 5 },
      models: { foo: rec(BASE_MAP), fooHigh: rec(OTHER_MAP) },
    };
    const raw = JSON.stringify(doc, null, 2) + '\n';
    fsImpl.writeFileSync(file, raw, 'utf-8');

    let status = 0;
    let stderr = '';
    try {
      execFileSync(process.execPath, [SCRIPT, '--file', file], { stdio: 'pipe' });
    } catch (err) {
      status = err.status;
      stderr = String(err.stderr);
    }
    expect(status).not.toBe(0);
    expect(stderr).toContain('fooHigh');
    expect(fsImpl.readFileSync(file, 'utf-8')).toBe(raw);
  });
});
