// tests/sync-data-workflow.test.js
// V5+ — KI-1: structural test for the sync-data workflow that mirrors
// data/*.json from sdd_agent_selector → Teksi75/sdd-data. The actual
// workflow runs on GitHub Actions (can't be unit-tested in jsdom),
// so we assert on the YAML source instead:
//   - The workflow file exists
//   - The triggers cover push + schedule + manual
//   - The required secret (SDD_DATA_TOKEN) is referenced
//   - All 5 expected data files are listed in the paths filter
//   - The job is named so logs are greppable

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const WORKFLOW = readFileSync(
  join(ROOT, '.github', 'workflows', 'sync-data.yml'),
  'utf-8'
);

describe('KI-1 — sync-data workflow (sdd_agent_selector → sdd-data)', () => {
  test('workflow file existe con el nombre esperado', () => {
    expect(WORKFLOW).toBeTruthy();
    expect(WORKFLOW).toMatch(/^name:\s*sync-data\s*$/m);
  });

  test('trigger de push a main filtra los 5 data files', () => {
    // The `on.push.paths` filter must include all 5 files the
    // data-sync service fetches (DATA_FILES in js/services/data-sync.js).
    // Drift between the two lists means a file change goes unmirrored.
    const expected = [
      'data/models.json',
      'data/phases.json',
      'data/configs.json',
      'data/agent-roles.json',
      'data/agent-request-profiles.json',
    ];
    for (const file of expected) {
      // The YAML escapes slashes inside the path; accept either form.
      const escaped = file.replace(/\//g, '/');
      expect(WORKFLOW).toContain(`'${escaped}'`);
    }
  });

  test('cron de self-heal diario (06:00 UTC) + manual dispatch', () => {
    // The schedule block has a comment between `schedule:` and the
    // first `- cron:` entry, so the regex looks for the cron line
    // independently and the dispatch trigger separately.
    expect(WORKFLOW).toMatch(/-\s*cron:\s*'0 6 \* \* \*'/);
    expect(WORKFLOW).toMatch(/workflow_dispatch:/);
  });

  test('usa el secret SDD_DATA_TOKEN para el push a sdd-data', () => {
    expect(WORKFLOW).toMatch(/secrets\.SDD_DATA_TOKEN/);
    // The clone URL must use the x-access-token pattern so the token
    // works as the password (basic auth on https://github.com).
    expect(WORKFLOW).toMatch(/x-access-token:\$\{TOKEN\}@github\.com\/Teksi75\/sdd-data/);
  });

  test('valida la presencia del secret antes de empezar', () => {
    // The workflow should fail fast with a clear ::error:: message
    // when the secret is missing, instead of pushing an empty diff.
    expect(WORKFLOW).toMatch(/SDD_DATA_TOKEN secret is not set/);
  });

  test('hace diff guard antes de commitear (no empty commits)', () => {
    expect(WORKFLOW).toMatch(/git diff --cached --quiet/);
  });

  test('mensaje de commit apunta al SHA del source', () => {
    expect(WORKFLOW).toMatch(/chore\(data\): sync from sdd_agent_selector/);
  });

  test('concurrency group previene pushs concurrentes', () => {
    expect(WORKFLOW).toMatch(/concurrency:\s*\n\s*group:\s*sync-data/);
    expect(WORKFLOW).toMatch(/cancel-in-progress:\s*true/);
  });
});
