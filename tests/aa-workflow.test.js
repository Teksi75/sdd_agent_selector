// @vitest-environment node
// tests/aa-workflow.test.js
// PR 5 — workflow registration + secret wiring + attribution for the
// Artificial Analysis (AA) scraper (change aa-benchmark-integration).
//
// We can't unit-test GitHub Actions itself, but we CAN assert the
// workflow YAML carries the required structural properties: the AA
// scraper is registered in ALL_SCRAPERS, the API key comes only from
// the GitHub secret (never hardcoded), and attribution is present.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = resolve(HERE, '..', '.github', 'workflows', 'sync-benchmarks.yml');
const SCRAPER = resolve(HERE, '..', 'scripts', 'scrape-artificialanalysis.js');

const yaml = readFileSync(WORKFLOW, 'utf-8');
const scraperSrc = readFileSync(SCRAPER, 'utf-8');

describe('sync-benchmarks.yml — AA scraper registration (PR 5)', () => {
  test('registers scrape-artificialanalysis in ALL_SCRAPERS', () => {
    expect(yaml).toMatch(/scrape-artificialanalysis/);
  });

  test('wires AA_API_KEY from the GitHub secret, never a hardcoded key', () => {
    expect(yaml).toMatch(/AA_API_KEY:\s*\${{ secrets\.AA_API_KEY }}/);
    // No literal `x-api-key: <long-token>` anywhere in the workflow.
    expect(yaml).not.toMatch(/x-api-key:\s*[A-Za-z0-9_\-]{20,}/);
  });

  test('the scraper reads AA_API_KEY from the environment', () => {
    expect(scraperSrc).toMatch(/process\.env\.AA_API_KEY/);
  });

  test('attribution to artificialanalysis.ai is present in the scraper', () => {
    expect(scraperSrc).toMatch(/https:\/\/artificialanalysis\.ai\//);
  });
});
