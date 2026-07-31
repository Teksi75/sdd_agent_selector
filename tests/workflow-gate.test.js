// @vitest-environment node
// tests/workflow-gate.test.js
// Phase 5 RED — strict TDD for the data-integrity gate in the
// sync-benchmarks GitHub Actions workflow.
//
// Spec: sdd/fix-sync-scraper-corruption/spec — "CI Data-Integrity Gate":
//   - data-integrity failure aborts commit
//   - test success allows commit
//   - [skip ci] does not bypass gate
//
// We can't unit-test GitHub Actions itself, but we CAN assert the
// workflow YAML carries the structural property: a step that runs
// `pnpm test tests/data-integrity.test.js` precedes the `git commit`
// step, and the commit-message string does NOT contain `[skip ci]`.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = resolve(HERE, '..', '.github', 'workflows', 'sync-benchmarks.yml');

const yaml = readFileSync(WORKFLOW, 'utf-8');

describe('sync-benchmarks.yml — CI data-integrity gate (RED)', () => {
  test('runs `pnpm test tests/data-integrity.test.js` somewhere in the workflow', () => {
    expect(yaml).toMatch(/pnpm\s+test\s+tests\/data-integrity\.test\.js/);
  });

  test('the integrity-test step appears BEFORE the `git commit` step in the YAML', () => {
    const integrityIdx = yaml.indexOf('pnpm test tests/data-integrity.test.js');
    const commitIdx = yaml.indexOf('git commit');
    expect(integrityIdx).toBeGreaterThan(-1);
    expect(commitIdx).toBeGreaterThan(-1);
    expect(integrityIdx).toBeLessThan(commitIdx);
  });

  test('the integrity-test step appears AFTER the structural validation step', () => {
    const validationIdx = yaml.indexOf('Validate data/models.json');
    const integrityIdx = yaml.indexOf('pnpm test tests/data-integrity.test.js');
    expect(validationIdx).toBeGreaterThan(-1);
    expect(integrityIdx).toBeGreaterThan(-1);
    expect(integrityIdx).toBeGreaterThan(validationIdx);
  });

  test('commit-message string does NOT contain `[skip ci]` (gate must not be bypassable)', () => {
    // Find the git commit line and verify the message string does not
    // contain `[skip ci]`. The previous shape had:
    //   git commit -m 'chore(sync): refresh data/models.json from upstream [skip ci]'
    expect(yaml).not.toMatch(/git commit[^\n]*\[skip ci\]/i);
  });

  test('the integrity-test step is wrapped in a `name:` block (not a bare command)', () => {
    // Find a step name that precedes the pnpm test command.
    const nameRe = /-\s+name:\s*([^\n]+)\n([\s\S]*?)pnpm test tests\/data-integrity\.test\.js/;
    const m = nameRe.exec(yaml);
    expect(m, 'expected a `name:` step to wrap the integrity test').not.toBeNull();
  });
});
