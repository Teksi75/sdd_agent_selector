// tests/data-integrity.test.js
// Phase 1 — Integrity between V3 source and V4 data file.
//
// Loads:
//   v3-monolith-backup.html  (canonical source from `Modelos SDD - V3 - Lucide.html`)
//   data/models.json         (transcribed Phase 1 deliverable)
//
// Asserts:
//   - same model count
//   - same key fingerprint per model (name, arena, input, output, tier at minimum)
//   - reference-tier models in V3 marked isReference in V4 (so charts/tables can hide them)
//
// Tolerance: We accept that V4 normalizes some V3 fields (tier `mid` → `balanced`).
// That is a documented mapping from design.md and is not a regression.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// --- V3 parser (lightweight regex over the MODELS object literal) ---
//
// The V3 file uses `key: { name:'...', arena:1234, ... }` records inside
// `const MODELS = { ... };`. We extract the object body with regex and
// parse each record by walking known field names. This keeps the test
// dependency-free and stable against minor V3 formatting changes.

const V3_BACKUP = join(ROOT, 'v3-monolith-backup.html');

/**
 * Extract the MODELS constant from the V3 HTML snapshot.
 * @param {string} html
 * @returns {Object<string, {name: string, arena: number|null, swePro: number|null,
 *                          sweVer: number|null, term: number|null, input: number,
 *                          output: number, tier: string, isReference?: boolean,
 *                          isNew?: boolean, notes?: string, rating?: number}>}
 */
function parseV3Models(html) {
  const startIdx = html.indexOf('const MODELS');
  if (startIdx < 0) throw new Error('V3 MODELS constant not found');
  const openBrace = html.indexOf('{', startIdx);
  if (openBrace < 0) throw new Error('V3 MODELS opening brace not found');
  // Walk braces to find matching close.
  let depth = 1;
  let i = openBrace + 1;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  const body = html.slice(openBrace + 1, i - 1);

  // Parse individual key records: `'key': { ... },`.
  const records = {};
  const recordRegex = /'([^']+)'\s*:\s*\{([^}]*)\}/g;
  let m;
  while ((m = recordRegex.exec(body)) !== null) {
    const [, key, fieldsBody] = m;
    const fields = {};
    const fieldRegex = /(\w+)\s*:\s*('([^']*)'|null|true|false|-?\d+(?:\.\d+)?)/g;
    let f;
    while ((f = fieldRegex.exec(fieldsBody)) !== null) {
      const [, name, rawValue, strValue] = f;
      if (rawValue === 'null') fields[name] = null;
      else if (rawValue === 'true') fields[name] = true;
      else if (rawValue === 'false') fields[name] = false;
      else if (strValue !== undefined) fields[name] = strValue;
      else fields[name] = Number(rawValue);
    }
    records[key] = fields;
  }
  return records;
}

/**
 * V3 tier "mid" → V4 spec tier "balanced" mapping.
 * V3 also allowed `tier: 'reference'` which we keep as-is.
 */
function normalizeTier(v3Tier) {
  if (v3Tier === 'mid') return 'balanced';
  return v3Tier;
}

describe('data-integrity: V3 source vs data/models.json', () => {
  const html = readFileSync(V3_BACKUP, 'utf-8');
  const v3 = parseV3Models(html);
  const v4raw = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));
  const v4 = v4raw.models;

  test('V3 parser extracts the same model count we expect', () => {
    // Sanity guard: we know V3 has 17 models (15 active + 2 reference).
    expect(Object.keys(v3).length).toBeGreaterThanOrEqual(15);
  });

  test('V4 has at least as many models as V3', () => {
    expect(Object.keys(v4).length).toBeGreaterThanOrEqual(Object.keys(v3).length);
  });

  test('every V3 model key exists in V4', () => {
    const v3Keys = Object.keys(v3).sort();
    const v4Keys = Object.keys(v4).sort();
    for (const k of v3Keys) {
      expect(v4Keys, `V4 missing V3 key: ${k}`).toContain(k);
    }
  });

  test('every V4 model key exists in V3 (no orphans)', () => {
    const v3Keys = new Set(Object.keys(v3));
    for (const k of Object.keys(v4)) {
      expect(v3Keys.has(k), `V4 has orphan key (not in V3): ${k}`).toBe(true);
    }
  });

  test('name, arena, input, output, tier match between V3 and V4', () => {
    for (const key of Object.keys(v3)) {
      const a = v3[key];
      const b = v4[key];
      expect(b, `V4 missing model ${key}`).toBeDefined();
      expect(b.name).toBe(a.name);
      // V3 stored arena as null/string; V4 uses null for unknown.
      const v3Arena = a.arena === null || a.arena === undefined ? null : Number(a.arena);
      expect(b.arena ?? null).toBe(v3Arena ?? null);
      expect(b.input).toBeCloseTo(Number(a.input), 6);
      expect(b.output).toBeCloseTo(Number(a.output), 6);
      // Tier mapping: V3 'mid' → V4 'balanced'; others unchanged.
      expect(b.tier).toBe(normalizeTier(a.tier));
    }
  });

  test('reference-tier models in V3 are flagged isReference in V4', () => {
    const v3Refs = Object.values(v3)
      .filter((m) => m.tier === 'reference')
      .map((m) => m.name);
    expect(v3Refs.length).toBeGreaterThan(0); // sanity
    for (const name of v3Refs) {
      const v4Model = Object.values(v4).find((m) => m.name === name);
      expect(v4Model, `V4 missing reference model ${name}`).toBeDefined();
      expect(v4Model.isReference).toBe(true);
      expect(v4Model.tier).toBe('reference');
    }
  });

  test('_meta block declares schemaVersion 1', () => {
    expect(v4raw._meta).toBeDefined();
    expect(v4raw._meta.schemaVersion).toBe(1);
    expect(v4raw._meta.lastSynced).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
