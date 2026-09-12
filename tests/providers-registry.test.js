// @vitest-environment node
// tests/providers-registry.test.js
// V5 data gate — `data/providers.json` is the closed, manually-owned provider
// registry. Every record has EXACTLY `{ id, name, tier, url, updated }`
// (design "Registry normativo"; `url` is the source of truth). The server side
// (loader) re-validates the same shape before caching; this gate fails loud at
// build time so a broken registry can never ship.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = join(ROOT, 'data', 'providers.json');
const MODELS_PATH = join(ROOT, 'data', 'models.json');
const REQUIRED_KEYS = ['id', 'name', 'tier', 'url', 'updated'];
const SEED_IDS = [
  'opencode-go',
  'chatgpt-plus',
  'minimax',
  'anthropic',
  'kimi',
  'zai-glm',
  'qwen',
  'xai',
  'deepseek',
];

describe('providers registry gate — data/providers.json', () => {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
  const providers = registry.providers;

  test('_meta.schemaVersion is 1 and providers is a non-empty array', () => {
    expect(registry._meta.schemaVersion).toBe(1);
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
  });

  test('every record has exactly { id, name, tier, url, updated } (no extras, all strings)', () => {
    // Guard against a "ghost loop": prove there are records before looping.
    expect(providers.length).toBeGreaterThan(0);
    const sortedKeys = [...REQUIRED_KEYS].sort();
    for (const record of providers) {
      expect(Object.keys(record).sort(), `record ${record?.id} key set`).toEqual(sortedKeys);
      for (const key of REQUIRED_KEYS) {
        expect(typeof record[key], `${record.id}.${key} must be a string`).toBe('string');
        expect(record[key].length, `${record.id}.${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  test('url is HTTPS and updated matches YYYY-MM-DD', () => {
    expect(providers.length).toBeGreaterThan(0);
    for (const record of providers) {
      expect(record.url, `${record.id}.url must be HTTPS`).toMatch(/^https:\/\//);
      expect(() => new URL(record.url), `${record.id}.url must parse`).not.toThrow();
      expect(record.updated, `${record.id}.updated must be ISO date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('ids are unique and cover every detected provider', () => {
    const ids = providers.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(SEED_IDS));
  });

  test('id set is the closed set reused by the availability matrix', () => {
    const models = JSON.parse(readFileSync(MODELS_PATH, 'utf-8')).models;
    const known = new Set(providers.map((p) => p.id));
    const unknown = new Set();
    for (const record of Object.values(models)) {
      for (const key of Object.keys(record.availability || {})) {
        if (!known.has(key)) unknown.add(key);
      }
    }
    expect([...unknown]).toEqual([]);
  });
});
