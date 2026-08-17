// @vitest-environment node
// tests/scrape-benchlm.test.js
// BenchLM scraper behavior — fetch, validate, alias-map, atomic write.
//
// Each test runs `runScrape` directly with a mocked `fetchText` so we
// never hit the real BenchLM endpoint. `args.file` points at a per-test
// temp models.json so the test fixture is isolated and the byte-identity
// assertions for the 5xx case are meaningful.
//
// Schema: bench-align-v5 (migrated 2026-08). The leaderboard payload is
// `{ models: [{ rank, model, overallScore, categoryScores, evidenceStatus }] }`.

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

/** Write the alias file with display-name mappings (matches data/benchlm-aliases.json shape). */
function writeAliases() {
  fsImpl.writeFileSync(
    aliasesPath,
    JSON.stringify({
      _meta: { version: 2 },
      aliases: [
        { from: 'Claude Fable 5', to: 'claudeFable5' },
        { from: 'Kimi K3', to: 'kimik3' },
        { from: 'MiMo V2.5', to: 'mimo25' },
        { from: 'MiMo-V2.5-Pro', to: 'mimo25pro' },
        { from: 'MiniMax M3', to: 'minimaxm3' },
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
  return JSON.stringify({ models: entries });
}

const BASE_ARGS = () => ({ dryRun: false, file: modelsPath, source: 'https://benchlm.test/api', quiet: true, aliasPath: aliasesPath });

describe('scrape-benchlm — happy path', () => {
  test('writes real benchlm numbers, preserves curated fields, advances _meta.lastSynced', async () => {
    writeAliases();
    writeModels(['claudeFable5', 'kimik3']);

    const fetchText = vi.fn(async () => benchlmResponse([
      { model: 'Claude Fable 5', overallScore: 82.96, evidenceStatus: 'supported', categoryScores: { coding: 80.81, math: null }, rank: 3 },
      { model: 'Kimi K3', overallScore: 80.5, evidenceStatus: 'estimated' },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);
    expect(result.changes).toBeGreaterThan(0);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));

    // Field mapping applied (overallScore → score, evidenceStatus → verified/reliability/evidence)
    expect(after.models.claudeFable5.benchlm.score).toBe(82.96);
    expect(after.models.claudeFable5.benchlm.verified).toBe(true);   // supported
    expect(after.models.claudeFable5.benchlm.reliability).toBe(0.75); // derived
    expect(after.models.claudeFable5.benchlm.evidence).toBe('supported');
    expect(after.models.claudeFable5.benchlm.categories).toEqual({ coding: 80.81, math: null });
    expect(after.models.claudeFable5.benchlm.rank).toBe(3);

    expect(after.models.kimik3.benchlm.score).toBe(80.5);
    expect(after.models.kimik3.benchlm.verified).toBe(false);        // estimated
    expect(after.models.kimik3.benchlm.reliability).toBe(0.4);       // derived

    // Curated fields preserved
    expect(after.models.claudeFable5.tier).toBe('high');
    expect(after.models.claudeFable5.name).toBe('claudeFable5');
    expect(after.models.claudeFable5.input).toBe(1.0);
    expect(after.models.claudeFable5.output).toBe(3.0);

    // _meta.lastSynced advanced (any ISO date string)
    expect(typeof after._meta.lastSynced).toBe('string');
    expect(after._meta.lastSynced).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // _meta.scrapers.benchlm.lastRun stamped so the freshness badge resets
    expect(after._meta.scrapers.benchlm.lastRun).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('alias-hit: a BenchLM display name present in the alias table maps to its curated key', async () => {
    writeAliases();
    writeModels(['minimaxm3']);

    const fetchText = vi.fn(async () => benchlmResponse([
      { model: 'MiniMax M3', overallScore: 68.74, evidenceStatus: 'supported' },
    ]));
    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.minimaxm3.benchlm.score).toBe(68.74);
    expect(after.models.minimaxm3.benchlm.verified).toBe(true);
  });

  test('alias-miss: unknown display names are skipped (WARN) — known models still update, no fatal', async () => {
    writeAliases();
    writeModels(['claudeFable5']);

    const fetchText = vi.fn(async () => benchlmResponse([
      { model: 'Claude Fable 5', overallScore: 82.96, evidenceStatus: 'supported' },
      { model: 'Claude Mythos 5', overallScore: 83.21, evidenceStatus: 'supported' }, // not in aliases
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });

    expect(result.ok).toBe(true);
    expect(result.skipped).toContain('Claude Mythos 5');

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.claudeFable5.benchlm.score).toBe(82.96);
    // The untracked model was NOT stubbed into the catalog.
    expect(after.models.claudeMythos5).toBeUndefined();
  });

  test('missing-known: tracked id absent from BenchLM response is preserved (no deletion, warn returned)', async () => {
    writeAliases();
    writeModels(['claudeFable5', 'kimik3', 'mimo25']);

    const fetchText = vi.fn(async () => benchlmResponse([
      // Only claudeFable5 + mimo25. kimik3 absent.
      { model: 'Claude Fable 5', overallScore: 82.96, evidenceStatus: 'supported' },
      { model: 'MiMo V2.5', overallScore: 70.0, evidenceStatus: 'estimated' },
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

  test('structure change (missing `overallScore`): scraper rejects payload, exits non-zero, file untouched', async () => {
    writeAliases();
    writeModels(['claudeFable5']);
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => benchlmResponse([
      { model: 'Claude Fable 5', evidenceStatus: 'supported' /* overallScore missing */ },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('validate');
    expect(result.error).toMatch(/overallScore/);

    const afterBytes = fsImpl.readFileSync(modelsPath, 'utf-8');
    expect(afterBytes).toBe(beforeBytes);
  });

  test('structure change (missing `evidenceStatus`): scraper rejects payload, exits non-zero', async () => {
    writeAliases();
    writeModels(['claudeFable5']);
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => benchlmResponse([
      { model: 'Claude Fable 5', overallScore: 82.96 /* evidenceStatus missing */ },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('validate');
    expect(result.error).toMatch(/evidenceStatus/);

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
      { model: 'Claude Fable 5', overallScore: 82.96, evidenceStatus: 'supported' },
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
      { model: 'Claude Fable 5', overallScore: 82.96, evidenceStatus: 'supported' },
    ]));

    const result = await runScrape(
      { ...BASE_ARGS(), file: customPath },
      { fetchText },
    );
    expect(result.ok).toBe(true);

    // Custom path was written.
    const customAfter = JSON.parse(fsImpl.readFileSync(customPath, 'utf-8'));
    expect(customAfter.models.claudeFable5.benchlm.score).toBe(82.96);

    // Default path was NOT touched.
    expect(fsImpl.readFileSync(defaultPath, 'utf-8')).toBe(defaultBefore);
  });

  test('--source <local-file>: reads the fixture from disk and writes benchlm blocks (no HTTP)', async () => {
    writeAliases();
    writeModels(['claudeFable5', 'kimik3']);

    // Write a fixture file in the tmpDir so we never touch the repo.
    const fixturePath = join(tmpDir, 'benchlm-fixture.json');
    fsImpl.writeFileSync(
      fixturePath,
      JSON.stringify({
        models: [
          { model: 'Claude Fable 5', overallScore: 82.96, evidenceStatus: 'supported', rank: 3 },
          { model: 'Kimi K3', overallScore: 80.5, evidenceStatus: 'supported', rank: 5 },
        ],
      }),
      'utf-8',
    );

    // fetchText MUST NOT be called — the local path is read directly.
    const fetchText = vi.fn(async () => {
      throw new Error('fetchText should not be invoked when --source is a local path');
    });

    const result = await runScrape(
      { ...BASE_ARGS(), source: fixturePath },
      { fetchText },
    );
    expect(result.ok).toBe(true);
    expect(fetchText).not.toHaveBeenCalled();

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.claudeFable5.benchlm.score).toBe(82.96);
    expect(after.models.kimik3.benchlm.score).toBe(80.5);
  });

  test('--source <local-file>: missing fixture returns fetch-phase error', async () => {
    writeAliases();
    writeModels(['claudeFable5']);

    const fetchText = vi.fn(async () => {
      throw new Error('fetchText should not be invoked for missing local fixture');
    });

    const result = await runScrape(
      { ...BASE_ARGS(), source: join(tmpDir, 'does-not-exist.json') },
      { fetchText },
    );
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('fetch');
    expect(fetchText).not.toHaveBeenCalled();
  });
});

describe('sync-benchmarks workflow — benchlm scheduling', () => {
  // Workflow file path resolved relative to the test file's location.
  const WORKFLOW_PATH = resolve(__dirname, '..', '.github', 'workflows', 'sync-benchmarks.yml');

  test('workflow YAML lists scrape-benchlm in the ALL_SCRAPERS array', () => {
    const yaml = fsImpl.readFileSync(WORKFLOW_PATH, 'utf-8');

    const arrayMatch = /ALL_SCRAPERS=\(\s*([\s\S]*?)\s*\)/.exec(yaml);
    expect(arrayMatch).not.toBeNull();
    const entries = arrayMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    expect(entries).toContain('scrape-benchlm');
  });

  test('workflow captures each scraper exit code independently (does not aggregate to one pass/fail)', () => {
    const yaml = fsImpl.readFileSync(WORKFLOW_PATH, 'utf-8');
    expect(yaml).toMatch(/if\s+!\s+node\s+["']scripts\/\$\{scraper\}\.js["']/);
    expect(yaml).toMatch(/failed=\$\(\(failed\s*\+\s*1\)\)/);
  });
});
