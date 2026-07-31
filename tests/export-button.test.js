// tests/export-button.test.js
// V5 — export-button component: shell HTML, dropdown open/close,
// format-action dispatch, document-level listener cleanup.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  renderButton,
  render,
  destroy,
  resetForTests,
} from '../js/components/export-button.js';

let target;
beforeEach(() => {
  target = document.createElement('div');
  document.body.appendChild(target);
});
afterEach(() => {
  destroy(target);
  if (target.parentNode) target.parentNode.removeChild(target);
  resetForTests();
  vi.useRealTimers();
});

/* ─────────────────────────── renderButton (pure HTML) ─────────────────────────── */

describe('renderButton — HTML shape', () => {
  test('returns empty string when no formats are provided', () => {
    expect(renderButton({ sectionId: 'foo', formats: [] })).toBe('');
  });

  test('returns empty string when formats is missing', () => {
    expect(renderButton({ sectionId: 'foo' })).toBe('');
  });

  test('renders a toggle button + dropdown with one row per format', () => {
    const html = renderButton({
      sectionId: 'ref-table',
      formats: [
        { id: 'copy-md', label: 'Copiar markdown', content: 'x' },
        { id: 'download-json', label: 'Descargar JSON', content: 'y', filename: 'a.json' },
      ],
    });
    expect(html).toContain('data-test="export-button"');
    expect(html).toContain('data-section-id="ref-table"');
    expect(html).toContain('data-action="toggle-export-dropdown"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Exportar');
    // 2 format rows
    const rows = (html.match(/data-action="export-format"/g) || []).length;
    expect(rows).toBe(2);
  });
});

/* ─────────────────────────── render (mount) ─────────────────────────── */

describe('render — mount + interactions', () => {
  const formats = [
    { id: 'copy-md', label: 'Copiar markdown', content: '# Hi' },
    { id: 'download-md', label: 'Descargar markdown', content: '# Hi', filename: 'a.md' },
  ];

  test('mounts the button shell and reports success', () => {
    const out = render(target, { sectionId: 'ref-table', formats });
    expect(out.mounted).toBe(true);
    expect(out.formats).toBe(2);
    expect(target.querySelector('[data-test="export-button"]')).not.toBeNull();
  });

  test('clicking the toggle opens the dropdown (aria-expanded=true)', () => {
    render(target, { sectionId: 'ref-table', formats });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    const dd = target.querySelector('[data-test="export-dropdown"]');
    expect(dd.classList.contains('hidden')).toBe(true);
    toggle.click();
    expect(dd.classList.contains('hidden')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  test('clicking the toggle a second time closes the dropdown', () => {
    render(target, { sectionId: 'ref-table', formats });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click(); // open
    toggle.click(); // close
    const dd = target.querySelector('[data-test="export-dropdown"]');
    expect(dd.classList.contains('hidden')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  test('clicking a format option closes the dropdown and shows a toast', async () => {
    // jsdom lacks navigator.clipboard.writeText → copyToClipboard returns false
    // (execCommand fallback also returns false in jsdom). Either way, the
    // important thing for this test is that a toast appears.
    render(target, { sectionId: 'ref-table', formats, copyMessage: 'Copiado' });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    const copyBtn = target.querySelector('[data-format-id="copy-md"]');
    copyBtn.click();
    // Wait one microtask for the async action
    await Promise.resolve();
    await Promise.resolve();
    const dd = target.querySelector('[data-test="export-dropdown"]');
    expect(dd.classList.contains('hidden')).toBe(true);
    const toast = document.querySelector('[data-test="export-toast"]');
    expect(toast).not.toBeNull();
  });

  test('clicking outside the export button closes the dropdown', () => {
    render(target, { sectionId: 'ref-table', formats });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    const dd = target.querySelector('[data-test="export-dropdown"]');
    expect(dd.classList.contains('hidden')).toBe(false);
    // Simulate a click on something outside the export button
    document.body.click();
    expect(dd.classList.contains('hidden')).toBe(true);
  });

  test('pressing Escape closes the dropdown', () => {
    render(target, { sectionId: 'ref-table', formats });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    const dd = target.querySelector('[data-test="export-dropdown"]');
    expect(dd.classList.contains('hidden')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dd.classList.contains('hidden')).toBe(true);
  });

  test('re-rendering into the same target cleans up the previous document listener', () => {
    const out1 = render(target, { sectionId: 'ref-table', formats });
    const out2 = render(target, { sectionId: 'ref-table', formats });
    expect(out1.mounted).toBe(true);
    expect(out2.mounted).toBe(true);
    // No leaked listener: clicking outside should still close the latest dropdown
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    document.body.click();
    const dd = target.querySelector('[data-test="export-dropdown"]');
    expect(dd.classList.contains('hidden')).toBe(true);
  });
});
