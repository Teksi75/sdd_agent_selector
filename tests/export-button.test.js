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

// V5+ P2-3: WAI-ARIA menu keyboard nav. The dropdown opens on toggle
// click and exposes the format items as a `role="menu"`. Roving
// tabindex + ArrowUp/Down + Home/End + Escape (closes + returns focus
// to toggle) are the WAI-ARIA Authoring Practices pattern.
describe('export-button — V5+ P2-3 keyboard nav (WAI-ARIA menu)', () => {
  const formats = [
    { id: 'copy-md', label: 'Copiar md', content: 'a' },
    { id: 'download-md', label: 'Descargar md', content: 'b', filename: 'x.md' },
    { id: 'download-json', label: 'Descargar json', content: 'c', filename: 'x.json' },
  ];

  test('mount asigna roving tabindex — primer item tabindex=0, resto -1', () => {
    render(target, { sectionId: 'ref-table', formats });
    const items = target.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(3);
    expect(items[0].getAttribute('tabindex')).toBe('0');
    expect(items[1].getAttribute('tabindex')).toBe('-1');
    expect(items[2].getAttribute('tabindex')).toBe('-1');
  });

  test('mount asigna aria-activedescendant al primer item', () => {
    render(target, { sectionId: 'ref-table', formats });
    const dd = target.querySelector('[data-test="export-dropdown"]');
    const active = dd.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    // El active item debe ser el primer menuitem.
    const firstItem = target.querySelectorAll('[role="menuitem"]')[0];
    expect(active).toBe(firstItem.id);
  });

  test('ArrowDown mueve el focus al siguiente item', async () => {
    render(target, { sectionId: 'ref-table', formats });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    // El open() enfoca el primer item con setTimeout(..., 0) para que
    // el dropdown esté visible antes del focus. En jsdom los timers no
    // se procesan solos, así que los flushamos manualmente antes de
    // dispatcheard el keydown.
    await new Promise((r) => setTimeout(r, 0));
    const items = target.querySelectorAll('[role="menuitem"]');
    expect(items[0].getAttribute('tabindex')).toBe('0');
    // Simulamos ArrowDown dispatcheado en el dropdown.
    const dd = target.querySelector('[data-test="export-dropdown"]');
    dd.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(items[1].getAttribute('tabindex')).toBe('0');
    expect(items[0].getAttribute('tabindex')).toBe('-1');
  });

  test('ArrowUp desde el primer item envuelve al último (wrap-around)', async () => {
    render(target, { sectionId: 'ref-table', formats });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    await new Promise((r) => setTimeout(r, 0));
    const items = target.querySelectorAll('[role="menuitem"]');
    const dd = target.querySelector('[data-test="export-dropdown"]');
    dd.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(items[2].getAttribute('tabindex')).toBe('0');
  });

  test('Home salta al primer item, End al último', async () => {
    render(target, { sectionId: 'ref-table', formats });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    await new Promise((r) => setTimeout(r, 0));
    const items = target.querySelectorAll('[role="menuitem"]');
    const dd = target.querySelector('[data-test="export-dropdown"]');
    // Mover a la mitad primero
    dd.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    dd.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(items[2].getAttribute('tabindex')).toBe('0');
    // Home → items[0]
    dd.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(items[0].getAttribute('tabindex')).toBe('0');
    // End → items[2]
    dd.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(items[2].getAttribute('tabindex')).toBe('0');
  });

  test('Escape cierra el dropdown y devuelve focus al toggle', () => {
    render(target, { sectionId: 'ref-table', formats });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    const dd = target.querySelector('[data-test="export-dropdown"]');
    expect(dd.classList.contains('hidden')).toBe(false);
    dd.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dd.classList.contains('hidden')).toBe(true);
    // focus() en jsdom es observable via document.activeElement
    expect(document.activeElement).toBe(toggle);
  });
});
