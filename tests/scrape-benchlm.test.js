// @vitest-environment node
// tests/scrape-benchlm.test.js
// BenchLM scraper behavior — fetch, validate, alias-map, atomic write.
//
// Each test runs `runScrape` directly with a mocked `fetchText` so we
// never hit the real BenchLM endpoint. `args.file` points at a per-test
// temp models.json so the test fixture is isolated and the byte-identity
// assertions for the 5xx case are meaningful.
//
// Pre-PR2: the scraper file does not exist (RED). Post-PR2: every test
// below must be GREEN.

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runScrape } from '../scripts/scrape-benchlm.js';

let tmpDir;
let modelsPath;
let aliasesPath;

beforeEach(() => {
  tmpDir = fsImpl.mkdtempSync(join(tmpdir(), 'scrape-benchlm-test-'));
  modelsPath = join(tmpDir, 'models.json');
  aliasesPath = join(tmpDir, 'benchlm-aliases.json');
});

afterEach(() => {
  if (tmpDir && fsImpl.existsSync(tmpDir)) {
    fsImpl.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/** Write the alias file with the 5 required mappings (matches data/benchlm-aliases.json). */
function writeAliases() {
  fsImpl.writeFileSync(
    aliasesPath,
    JSON.stringify({
      _meta: { version: 1 },
      aliases: [
        { from: 'claude-fable-5', to: 'claudeFable5' },
        { from: 'kimi-k3', to: 'kimik3' },
        { from: 'mimo-v2-5', to: 'mimo25' },
        { from: 'mimo-v2-5-pro', to: 'mimo25pro' },
        { from: 'minimax-m3', to: 'minimaxm3' },
      ],
    }, null, 2),
    'utf-8',
  );
}

/** Write a small models.json with placeholder benchlm blocks for the curated keys we test. */
function writeModels(keys) {
  const models = {};
  for (const k of keys) {
    models[k] = {
      name: k,
      tier: 'high',
      input: 1.0,
      output: 3.0,
      benchlm: { score: null, verified: false, reliability: 0, categories: {} },
    };
  }
  fsImpl.writeFileSync(
    modelsPath,
    JSON.stringify({ _meta: { schemaVersion: 2 }, models }, null, 2),
    'utf-8',
  );
}

function benchlmResponse(entries) {
  return JSON.stringify({ rankings: entries });
}

const BASE_ARGS = () => ({ dryRun: false, file: modelsPath, source: 'https://benchlm.test/api', quiet: true });

describe('scrape-benchlm — happy path', () => {
  test('writes real benchlm numbers, preserves curated fields, advances _meta.lastSynced', async () => {
    writeAliases();
    writeModels(['claudeFable5', 'kimik3']);

    const fetchText = vi.fn(async () => benchlmResponse([
      { id: 'claude-fable-5', score: 78.3, verified: true, reliability: 0.92, categories: { coding: 82, math: 75 } },
      { id: 'kimi-k3', score: 71.5, verified: false, reliability: 0.6 },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);
    expect(result.changes).toBeGreaterThan(0);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));

    // Alias mapping applied
    expect(after.models.claudeFable5.benchlm.score).toBe(78.3);
    expect(after.models.claudeFable5.benchlm.verified).toBe(true);
    expect(after.models.claudeFable5.benchlm.reliability).toBe(0.92);
    expect(after.models.claudeFable5.benchlm.categories).toEqual({ coding: 82, math: 75 });

    expect(after.models.kimik3.benchlm.score).toBe(71.5);
    expect(after.models.kimik3.benchlm.verified).toBe(false);
    expect(after.models.kimik3.benchlm.reliability).toBe(0.6);

    // Curated fields preserved
    expect(after.models.claudeFable5.tier).toBe('high');
    expect(after.models.claudeFable5.name).toBe('claudeFable5');
    expect(after.models.claudeFable5.input).toBe(1.0);
    expect(after.models.claudeFable5.output).toBe(3.0);

    // _meta.lastSynced advanced (any ISO date string)
    expect(typeof after._meta.lastSynced).toBe('string');
    expect(after._meta.lastSynced).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('alias-hit: a BenchLM id present in the alias table maps to its curated key', async () => {
    writeAliases();
    writeModels(['minimaxm3']);

    const fetchText = vi.fn(async () => benchlmResponse([
      { id: 'minimax-m3', score: 80, verified: true, reliability: 0.8 },
    ]));
    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.minimaxm3.benchlm.score).toBe(80);
  });

  test('alias-miss: a BenchLM id absent from the alias table exits non-zero with the id named', async () => {
    writeAliases();
    writeModels(['claudeFable5']);

    const fetchText = vi.fn(async () => benchlmResponse([
      { id: 'claude-fable-5', score: 78.3, verified: true },
      { id: 'totally-new-model-x', score: 50, verified: false }, // not in aliases
    ]));

    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');
    const result = await runScrape(BASE_ARGS(), { fetchText });
    const afterBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    expect(result.ok).toBe(false);
    expect(result.phase).toBe('alias');
    expect(result.error).toMatch(/totally-new-model-x/);
    expect(result.benchlmId).toBe('totally-new-model-x');

    // data/models.json untouched (5xx-equivalent invariant for alias failure)
    expect(afterBytes).toBe(beforeBytes);
  });

  test('missing-known: tracked id absent from BenchLM response is preserved (no deletion, warn returned)', async () => {
    writeAliases();
    writeModels(['claudeFable5', 'kimik3', 'mimo25']);

    const fetchText = vi.fn(async () => benchlmResponse([
      // Only claudeFable5 + mimo25. kimik3 absent.
      { id: 'claude-fable-5', score: 78.3, verified: true, reliability: 0.9 },
      { id: 'mimo-v2-5', score: 70.0, verified: false, reliability: 0.7 },
    ]));

    const result = await runScrape({ ...BASE_ARGS(), quiet: false }, { fetchText });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual(['kimik3']); // sorted

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.kimik3).toBeDefined(); // record preserved
    expect(after.models.kimik3.benchlm.score).toBeNull(); // placeholder retained
  });
});

describe('scrape-benchlm — failure modes', () => {
  test('5xx response: scraper exits non-zero and data/models.json is byte-identical to pre-run', async () => {
    writeAliases();
    writeModels(['claudeFable5']);
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => {
      throw new Error('fetch https://benchlm.test/api → HTTP 503 Service Unavailable');
    });

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('fetch');
    expect(result.error).toMatch(/503/);

    const afterBytes = fsImpl.readFileSync(modelsPath, 'utf-8');
    expect(afterBytes).toBe(beforeBytes);
  });

  test('structure change (missing `score`): scraper rejects payload, exits non-zero, file untouched', async () => {
    writeAliases();
    writeModels(['claudeFable5']);
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => benchlmResponse([
      { id: 'claude-fable-5', verified: true /* score missing */ },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('validate');
    expect(result.error).toMatch(/score/);

    const afterBytes = fsImpl.readFileSync(modelsPath, 'utf-8');
    expect(afterBytes).toBe(beforeBytes);
  });

  test('non-JSON response: scraper rejects payload, exits non-zero, file untouched', async () => {
    writeAliases();
    writeModels(['claudeFable5']);
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => '<html>Not JSON</html>');
    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('parse');
    expect(fsImpl.readFileSync(modelsPath, 'utf-8')).toBe(beforeBytes);
  });

  test('top-level not an object: scraper rejects, file untouched', async () => {
    writeAliases();
    writeModels(['claudeFable5']);
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => '"just a string"');
    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('validate');
    expect(fsImpl.readFileSync(modelsPath, 'utf-8')).toBe(beforeBytes);
  });
});

describe('scrape-benchlm — CLI flags', () => {
  test('--dry-run: parses + logs diff but does NOT write', async () => {
    writeAliases();
    writeModels(['claudeFable5']);
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => benchlmResponse([
      { id: 'claude-fable-5', score: 78.3, verified: true, reliability: 0.9 },
    ]));

    const result = await runScrape({ ...BASE_ARGS(), dryRun: true }, { fetchText });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.changes).toBeGreaterThan(0);

    const afterBytes = fsImpl.readFileSync(modelsPath, 'utf-8');
    expect(afterBytes).toBe(beforeBytes);
  });

  test('--file: writes to the override path (not the default data/models.json)', async () => {
    writeAliases();
    // Two separate files: the default path vs the --file override.
    const defaultPath = join(tmpDir, 'data', 'models.json');
    fsImpl.mkdirSync(join(tmpDir, 'data'), { recursive: true });
    writeModels(['claudeFable5']);
    // Move the file to the default path (writeModels wrote to modelsPath which is also the override; rename to defaultPath).
    fsImpl.renameSync(modelsPath, defaultPath);
    const customPath = join(tmpDir, 'override-models.json');
    fsImpl.writeFileSync(customPath, fsImpl.readFileSync(defaultPath, 'utf-8'), 'utf-8');

    const defaultBefore = fsImpl.readFileSync(defaultPath, 'utf-8');

    const fetchText = vi.fn(async () => benchlmResponse([
      { id: 'claude-fable-5', score: 78.3, verified: true, reliability: 0.9 },
    ]));

    const result = await runScrape(
      { ...BASE_ARGS(), file: customPath },
      { fetchText },
    );
    expect(result.ok).toBe(true);

    // Custom path was written.
    const customAfter = JSON.parse(fsImpl.readFileSync(customPath, 'utf-8'));
    expect(customAfter.models.claudeFable5.benchlm.score).toBe(78.3);

    // Default path was NOT touched.
    expect(fsImpl.readFileSync(defaultPath, 'utf-8')).toBe(defaultBefore);
  });
});
