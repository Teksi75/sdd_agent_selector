// tests/effort-tag.test.js
// PR-B (effort-only UI) — shared effort-tag renderer (design D4).
//
// Contract:
//   - closed vocabulary: max | xhigh | high | medium | low | non-reasoning
//   - rioplatense labels already shipped by the four surfaces
//   - pure HTML renderer with escaping
//   - ZERO badge for missing/invalid effort: never invent a label
//   - softFallback: true suppresses the badge entirely (fallback = name only)

import { describe, test, expect } from 'vitest';
import {
  EFFORT_VOCABULARY,
  EFFORT_LABELS,
  isEffort,
  effortLabel,
  effortTagHtml,
} from '../js/components/effort-tag.js';

const EXPECTED_VOCABULARY = ['max', 'xhigh', 'high', 'medium', 'low', 'non-reasoning'];
const EXPECTED_LABELS = {
  max: 'Máximo',
  xhigh: 'Extremo alto',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
  'non-reasoning': 'Sin razonamiento',
};

describe('effort-tag — closed vocabulary', () => {
  test('vocabulary is exactly the closed set and frozen', () => {
    expect([...EFFORT_VOCABULARY].sort()).toEqual([...EXPECTED_VOCABULARY].sort());
    expect(Object.isFrozen(EFFORT_VOCABULARY)).toBe(true);
  });

  test('labels keep the existing rioplatense wording for every vocabulary value', () => {
    expect(Object.keys(EFFORT_LABELS).sort()).toEqual([...EXPECTED_VOCABULARY].sort());
    for (const effort of EXPECTED_VOCABULARY) {
      expect(EFFORT_LABELS[effort]).toBe(EXPECTED_LABELS[effort]);
    }
    expect(Object.isFrozen(EFFORT_LABELS)).toBe(true);
  });

  test('isEffort accepts only vocabulary strings', () => {
    for (const effort of EXPECTED_VOCABULARY) expect(isEffort(effort)).toBe(true);
    expect(isEffort('turbo')).toBe(false);
    expect(isEffort('MAX')).toBe(false);
    expect(isEffort(42)).toBe(false);
    expect(isEffort(null)).toBe(false);
    expect(isEffort(undefined)).toBe(false);
    expect(isEffort({})).toBe(false);
  });

  test('effortLabel resolves vocabulary values and returns null outside the set', () => {
    expect(effortLabel('max')).toBe('Máximo');
    expect(effortLabel('non-reasoning')).toBe('Sin razonamiento');
    expect(effortLabel('turbo')).toBeNull();
    expect(effortLabel('')).toBeNull();
    expect(effortLabel(undefined)).toBeNull();
  });
});

describe('effort-tag — renderer', () => {
  test.each(EXPECTED_VOCABULARY.map((effort) => [effort, EXPECTED_LABELS[effort]]))(
    'renders the %s badge with its rioplatense label',
    (effort, label) => {
      const html = effortTagHtml(effort);
      expect(html).toContain(`data-effort="${effort}"`);
      expect(html).toContain(`>${label}</span>`);
      expect(html).toContain('src-effort');
    }
  );

  test('renders zero badge for missing effort (undefined/null/empty string)', () => {
    expect(effortTagHtml(undefined)).toBe('');
    expect(effortTagHtml(null)).toBe('');
    expect(effortTagHtml('')).toBe('');
  });

  test('renders zero badge for out-of-vocabulary effort (no invented labels)', () => {
    expect(effortTagHtml('turbo')).toBe('');
    expect(effortTagHtml('MAX')).toBe('');
    expect(effortTagHtml(' max')).toBe('');
    expect(effortTagHtml(42)).toBe('');
    expect(effortTagHtml({ effort: 'max' })).toBe('');
  });

  test('hostile HTML in the effort value never reaches the output', () => {
    const hostile = '"><img src=x onerror=alert(1)>';
    const html = effortTagHtml(hostile);
    expect(html).toBe('');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror');
  });

  test('a hostile label wrapper can not inject markup through the vocabulary', () => {
    // The label comes from the frozen map, never from the caller: even a
    // vocabulary member carrying HTML-ish text stays escaped/closed.
    for (const effort of EXPECTED_VOCABULARY) {
      const html = effortTagHtml(effort);
      expect(html).not.toMatch(/<(script|img|iframe)/i);
    }
  });

  test('softFallback: true suppresses the badge even for a valid effort', () => {
    expect(effortTagHtml('max', { softFallback: true })).toBe('');
    expect(effortTagHtml('xhigh', { softFallback: true })).toBe('');
    expect(effortTagHtml('max', { softFallback: false })).toContain('data-effort="max"');
    expect(effortTagHtml('max', {})).toContain('data-effort="max"');
  });

  test('is pure: repeated calls with the same input return identical HTML', () => {
    expect(effortTagHtml('high')).toBe(effortTagHtml('high'));
    expect(effortTagHtml('turbo')).toBe(effortTagHtml('turbo'));
  });
});
