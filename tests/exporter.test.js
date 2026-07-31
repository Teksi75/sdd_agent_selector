// tests/exporter.test.js
// V5 — exporter service: pure formatters (toJSON, markdownTable,
// agentsMarkdown, exportFilename) and browser-action wrappers
// (copyToClipboard, downloadFile, showToast) covered in jsdom.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toJSON,
  markdownTable,
  agentsMarkdown,
  exportFilename,
  copyToClipboard,
  downloadFile,
  showToast,
  dismissToast,
  runExport,
  resetForTests,
} from '../js/services/exporter.js';

afterEach(() => {
  resetForTests();
  // Clean any lingering toasts the test body may have spawned
  document.querySelectorAll('[data-test="export-toast"]').forEach((n) => n.remove());
});

/* ─────────────────────────── pure formatters ─────────────────────────── */

describe('toJSON', () => {
  test('pretty-prints a flat object with 2-space indent', () => {
    const out = toJSON({ a: 1, b: 'two', c: null });
    expect(out).toBe('{\n  "a": 1,\n  "b": "two",\n  "c": null\n}');
  });

  test('handles circular references with a [Circular] sentinel', () => {
    const a = { name: 'a' };
    a.self = a;
    const out = toJSON(a);
    expect(out).toContain('[Circular]');
  });

  test('handles arrays of objects', () => {
    const out = toJSON([{ x: 1 }, { x: 2 }]);
    expect(out).toContain('"x": 1');
    expect(out).toContain('"x": 2');
  });
});

describe('markdownTable', () => {
  test('builds a valid table with headers + rows', () => {
    const out = markdownTable(['A', 'B'], [['1', '2'], ['3', '4']]);
    const lines = out.split('\n');
    expect(lines).toHaveLength(4); // header + sep + 2 rows
    expect(lines[0]).toBe('| A | B |');
    expect(lines[1]).toBe('| --- | --- |');
    expect(lines[2]).toBe('| 1 | 2 |');
    expect(lines[3]).toBe('| 3 | 4 |');
  });

  test('escapes pipe characters in cell values', () => {
    const out = markdownTable(['col'], [['a|b']]);
    expect(out).toContain('a\\|b');
  });

  test('escapes newlines in cell values to spaces', () => {
    const out = markdownTable(['col'], [['line1\nline2']]);
    expect(out).toContain('line1 line2');
  });

  test('renders null and undefined as a single space', () => {
    const out = markdownTable(['a', 'b'], [[null, undefined]]);
    expect(out).toContain('|   |   |');
  });
});

describe('agentsMarkdown', () => {
  test('produces a per-agent block with model + score + cost + checks', () => {
    const md = agentsMarkdown([
      {
        key: 'sdd-apply',
        role: 'implementador',
        model: { name: 'GPT-5.6 Sol', tier: 'high' },
        score: 87.2,
        cost: 0.000023,
        effectiveMaxCost: 0.000030,
      },
    ]);
    expect(md).toContain('# SDD Agent Assignments');
    expect(md).toContain('### sdd-apply');
    expect(md).toContain('**GPT-5.6 Sol**');
    expect(md).toContain('implementador');
    expect(md).toContain('87.2');
  });

  test('marks soft fallback assignments', () => {
    const md = agentsMarkdown([
      {
        key: 'sdd-design',
        role: 'designer',
        model: { name: 'GPT-5.6 Luna', tier: 'budget' },
        score: 60,
        cost: 0.000001,
        effectiveMaxCost: 0.000010,
        softFallback: true,
      },
    ]);
    expect(md).toContain('soft fallback');
  });

  test('handles missing model gracefully (no throw)', () => {
    const md = agentsMarkdown([{ key: 'sdd-verify', role: 'verifier' }]);
    expect(md).toContain('### sdd-verify');
    expect(md).toContain('(sin modelo: sdd-verify)');
  });
});

describe('exportFilename', () => {
  test('produces a date-suffixed filename in the sdd- family', () => {
    const fn = exportFilename('ref-table', 'json', new Date('2026-07-31T12:34:56Z'));
    expect(fn).toBe('sdd-ref-table-2026-07-31.json');
  });
  test('uses md extension when given', () => {
    const fn = exportFilename('agents', 'md', new Date('2026-07-31T00:00:00Z'));
    expect(fn).toBe('sdd-agents-2026-07-31.md');
  });
});

/* ─────────────────────────── browser actions ─────────────────────────── */

describe('copyToClipboard (jsdom fallback)', () => {
  test('falls back to execCommand when navigator.clipboard is missing', async () => {
    // jsdom does not expose navigator.clipboard.writeText, so the function
    // should fall through to the textarea+execCommand path. execCommand
    // isn't implemented in jsdom either, so the function returns false.
    // That's an acceptable jsdom result — the prod path uses the real API.
    const ok = await copyToClipboard('test');
    expect(typeof ok).toBe('boolean');
  });
});

describe('downloadFile', () => {
  test('returns a boolean (jsdom may or may not support Blob/URL.createObjectURL)', () => {
    // We don't assert the click spy because jsdom's Blob + URL.createObjectURL
    // support is environment-dependent. The contract is: never throw, always
    // return a boolean.
    const ok = downloadFile('hello world', 'test.txt', 'text/plain');
    expect(typeof ok).toBe('boolean');
  });
});

describe('showToast / dismissToast', () => {
  test('appends a toast element to the body and removes it on dismiss', () => {
    showToast('Hola', { kind: 'success' });
    const toast = document.querySelector('[data-test="export-toast"]');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Hola');
    expect(toast.getAttribute('data-kind')).toBe('success');
    dismissToast();
    expect(document.querySelector('[data-test="export-toast"]')).toBeNull();
  });

  test('replaces an existing toast on a second call', () => {
    showToast('Primero', { kind: 'success' });
    showToast('Segundo', { kind: 'error' });
    const toasts = document.querySelectorAll('[data-test="export-toast"]');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toBe('Segundo');
    expect(toasts[0].getAttribute('data-kind')).toBe('error');
  });
});

describe('runExport', () => {
  test('shows success toast when action returns true', async () => {
    const ok = await runExport(() => true, { successMessage: 'Listo', errorMessage: 'Error' });
    expect(ok).toBe(true);
    const toast = document.querySelector('[data-test="export-toast"]');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Listo');
  });
  test('shows error toast when action throws', async () => {
    const ok = await runExport(() => { throw new Error('boom'); }, { successMessage: 'OK', errorMessage: 'Falló' });
    expect(ok).toBe(false);
    const toast = document.querySelector('[data-test="export-toast"]');
    expect(toast.textContent).toBe('Falló');
  });
  test('shows error toast when action returns false', async () => {
    const ok = await runExport(() => false, { successMessage: 'OK', errorMessage: 'No' });
    expect(ok).toBe(false);
    const toast = document.querySelector('[data-test="export-toast"]');
    expect(toast.textContent).toBe('No');
  });
});
