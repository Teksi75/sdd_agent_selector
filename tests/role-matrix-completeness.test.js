// tests/role-matrix-completeness.test.js
// Phase 1 — Verifies data/agent-roles.json covers exactly the 18-agent
// canonical list (11 SDD + 3 JD + 4 Review) from spec.md "Data Layer — Agent Roles".

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// Canonical 18-agent list — MUST match the spec verbatim.
export const CANONICAL_18 = Object.freeze([
  // 11 SDD agents
  'gentle-orchestrator',
  'sdd-init',
  'sdd-explore',
  'sdd-propose',
  'sdd-spec',
  'sdd-design',
  'sdd-tasks',
  'sdd-apply',
  'sdd-verify',
  'sdd-archive',
  'sdd-onboard',
  // 3 JD agents
  'jd-judge-a',
  'jd-judge-b',
  'jd-fix-agent',
  // 4 Review agents
  'review-risk',
  'review-readability',
  'review-reliability',
  'review-resilience',
]);

describe('role-matrix completeness — data/agent-roles.json', () => {
  const matrix = JSON.parse(
    readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8')
  ).roles;

  test('has exactly 18 entries', () => {
    expect(Object.keys(matrix).length).toBe(18);
  });

  test('keys match canonical 18-agent list (order-independent, case-sensitive)', () => {
    const actual = new Set(Object.keys(matrix));
    const expected = new Set(CANONICAL_18);
    expect(actual).toEqual(expected);
  });

  test('every entry has all three required fields with correct types', () => {
    for (const [agent, fields] of Object.entries(matrix)) {
      expect(typeof fields.minReasoning, `${agent}.minReasoning must be number`).toBe('number');
      expect(Number.isFinite(fields.minReasoning), `${agent}.minReasoning must be finite`).toBe(true);
      expect(fields.minReasoning, `${agent}.minReasoning must be >= 0`).toBeGreaterThanOrEqual(0);
      expect(fields.minReasoning, `${agent}.minReasoning must be <= 100`).toBeLessThanOrEqual(100);

      expect(typeof fields.costRatio, `${agent}.costRatio must be number`).toBe('number');
      expect(Number.isFinite(fields.costRatio), `${agent}.costRatio must be finite`).toBe(true);
      expect(fields.costRatio, `${agent}.costRatio must be >= 0`).toBeGreaterThanOrEqual(0);

      expect(typeof fields.role, `${agent}.role must be string`).toBe('string');
      expect(fields.role.length, `${agent}.role must be non-empty`).toBeGreaterThan(0);
    }
  });

  test('gentle-orchestrator.minReasoning >= 90 and costRatio = 1.0', () => {
    const orch = matrix['gentle-orchestrator'];
    expect(orch.minReasoning).toBeGreaterThanOrEqual(90);
    expect(orch.costRatio).toBeCloseTo(1.0, 6);
  });

  test('sdd-archive.costRatio <= 0.05 (cheapest agent)', () => {
    const archive = matrix['sdd-archive'];
    expect(archive.costRatio).toBeLessThanOrEqual(0.05);
    // Strictly cheapest among all 18.
    const allRatios = Object.values(matrix).map((m) => m.costRatio);
    const minRatio = Math.min(...allRatios);
    expect(archive.costRatio).toBeCloseTo(minRatio, 6);
  });

  test('sdd-apply.costRatio = 1.0 (ceiling executor)', () => {
    expect(matrix['sdd-apply'].costRatio).toBeCloseTo(1.0, 6);
  });
});
