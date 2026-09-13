// @vitest-environment node
// tests/scraper-provider-registry.test.js
// V5 write-guard gate — `data/providers.json` is manual curation and sits
// OUTSIDE every scraper write path. Each of the 8 sequential scrapers runs a
// network-free dry-run (empty `data:` source) and the registry must stay
// byte-identical, with the same id set, and the dry-run must never write the
// models target. No scraper may create, rename or delete a provider id.

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS_JSON_PATH } from '../scripts/_scraper-utils.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDERS_PATH = join(ROOT, 'data', 'providers.json');
const MODELS_PATH = join(ROOT, 'data', 'models.json');
const EMPTY_PAGE = 'data:text/html,<html><body>registry-guard</body></html>';
const SCRAPERS = [
  'scrape-opencode-prices',
  'scrape-openai-pricing',
  'scrape-anthropic-pricing',
  'scrape-arena-leaderboard',
  'scrape-glm-blog',
  'scrape-swebench-leaderboard',
  'scrape-benchlm',
  'scrape-artificialanalysis',
];

let tmpDir;
let tmpModels;
let providersBefore;
let providersIdsBefore;
let modelsBefore;

beforeAll(() => {
  tmpDir = fsImpl.mkdtempSync(join(tmpdir(), 'registry-guard-'));
  tmpModels = join(tmpDir, 'models.json');
  fsImpl.copyFileSync(MODELS_PATH, tmpModels);
  providersBefore = fsImpl.readFileSync(PROVIDERS_PATH);
  providersIdsBefore = JSON.parse(providersBefore.toString()).providers.map((p) => p.id).sort();
  modelsBefore = fsImpl.readFileSync(tmpModels);
});

afterAll(() => {
  if (tmpDir && fsImpl.existsSync(tmpDir)) fsImpl.rmSync(tmpDir, { recursive: true, force: true });
});

describe('registry immutability across the 8 scrapers', () => {
  test('the registry path is outside MODELS_JSON_PATH and no scraper source names it', () => {
    expect(MODELS_JSON_PATH.endsWith(join('data', 'models.json'))).toBe(true);
    expect(PROVIDERS_PATH).not.toBe(MODELS_JSON_PATH);
    expect(PROVIDERS_PATH.startsWith(join(ROOT, 'scripts'))).toBe(false);
    expect(SCRAPERS).toHaveLength(8);
    const offenders = [];
    for (const name of SCRAPERS) {
      const source = fsImpl.readFileSync(join(ROOT, 'scripts', `${name}.js`), 'utf-8');
      if (!source.includes('writeModelsJson')) offenders.push(`${name}: no shared write API`);
      if (source.includes('providers.json')) offenders.push(`${name}: names providers.json`);
    }
    expect(offenders).toEqual([]);
  });

  test('dry-run of each scraper leaves providers.json byte-identical and writes nothing', () => {
    expect(SCRAPERS).toHaveLength(8);
    for (const name of SCRAPERS) {
      let status = 0;
      try {
        execFileSync(
          process.execPath,
          [join(ROOT, 'scripts', `${name}.js`), '--dry-run', '--file', tmpModels, '--source', EMPTY_PAGE, '--quiet'],
          { stdio: 'pipe', timeout: 30000 }
        );
      } catch (err) {
        // A dry-run may fail loud on an empty upstream page; that is fine —
        // the invariant is that neither file may change.
        status = err.status ?? 1;
      }
      expect([0, 1], `${name} exit status`).toContain(status);
      expect(
        fsImpl.readFileSync(PROVIDERS_PATH).equals(providersBefore),
        `${name} must not touch providers.json`
      ).toBe(true);
      expect(
        fsImpl.readFileSync(tmpModels).equals(modelsBefore),
        `${name} dry-run must not write models.json`
      ).toBe(true);
    }
    const idsAfter = JSON.parse(fsImpl.readFileSync(PROVIDERS_PATH).toString())
      .providers.map((p) => p.id)
      .sort();
    expect(idsAfter).toEqual(providersIdsBefore);
  });
});
