// tests/app-filter.test.js
// V5 Slice 3 — app.js state + render transaction.
//
// One `recompute(reason)` owns the pipeline: derive `eligibleModels` ONCE with
// applyProviderFilter, inject that object into config-selector, compute the 18
// assignments with the twin gate BEFORE mutating visible state, then re-render
// every mount (selector count, hero, tables, charts, workflow, CLI,
// justification, export content). Boot, `sdd-provider-filter-change` and data
// refresh share this entry point — there is no synthetic refresh click.
//
// The tests drive `createApp({ load })` with an injected fixture loader so the
// whole transaction is exercised without network/storage.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../js/app.js';
import { buildSurfaceFixture } from './fixtures/v5-surfaces-fixture.js';
import { resetForTests as resetConfigSelector } from '../js/components/config-selector.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const APP_SOURCE = readFileSync(join(ROOT, 'js', 'app.js'), 'utf-8');

const MOUNT_IDS = [
  'subscription-selector-mount',
  'config-mount',
  'hero-stats-mount',
  'ref-table-mount',
  'composite-chart-mount',
  'pricing-chart-mount',
  'workflow-mount',
  'cli-mirror-mount',
  'justification-mount',
];

function setupDom() {
  document.body.innerHTML = MOUNT_IDS.map((id) => `<section id="${id}"></section>`).join('');
}

function bootWith(fixture) {
  const app = createApp({
    load: async () => fixture,
    document,
    wireShortcuts: false,
    wireFreshness: false,
  });
  return app.boot().then(() => app);
}

function setEnabledViaEvent(enabledIds) {
  const detail = {
    version: 1,
    enabled: Object.fromEntries(enabledIds.map((id) => [id, true])),
    enabledIds,
  };
  window.dispatchEvent(new CustomEvent('sdd-provider-filter-change', { detail }));
}

beforeEach(() => {
  localStorage.clear();
  setupDom();
  resetConfigSelector();
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('app-filter — state explícito y transacción recompute', () => {
  test('expone { data, enabledSet, eligibleModels, activeConfigKey, assignments, filterRevision }', async () => {
    const app = await bootWith(buildSurfaceFixture());
    const state = app.getState();
    expect(Object.keys(state).sort()).toEqual([
      'activeConfigKey',
      'assignments',
      'data',
      'eligibleModels',
      'enabledSet',
      'filterRevision',
    ]);
    expect(state.enabledSet).toEqual(['alpha', 'beta']);
    expect(Object.keys(state.eligibleModels).sort()).toEqual([
      'alphaOnly',
      'betaOnly',
      'ref',
      'shared',
    ]);
    expect(state.activeConfigKey).toBe('balanceado');
    expect(Object.keys(state.assignments).length).toBe(18);
    expect(state.filterRevision).toBe(1);
  });

  test('eligibleModels es la proyección única de applyProviderFilter sobre el catálogo', async () => {
    const fixture = buildSurfaceFixture();
    const app = await bootWith(fixture);
    // Order + record identity follow the catalog.
    expect(Object.keys(app.getState().eligibleModels)).toEqual(
      Object.keys(fixture.models)
    );
  });

  test('sdd-provider-filter-change re-renderiza TODOS los mounts (hide-not-dim)', async () => {
    const app = await bootWith(buildSurfaceFixture());
    setEnabledViaEvent(['alpha']);

    const state = app.getState();
    expect(state.enabledSet).toEqual(['alpha']);
    expect(Object.keys(state.eligibleModels).sort()).toEqual(['alphaOnly', 'ref', 'shared']);
    expect(state.filterRevision).toBe(2);

    // Selector count + empty state.
    expect(
      document.querySelector('#subscription-selector-mount [data-role="visible-count"]').textContent
    ).toMatch(/3 modelos visibles/);

    // Hero: X de Y visibles (Y = 3 activos del catálogo completo, estable).
    const heroText = document
      .querySelector('#hero-stats-mount')
      .textContent.replace(/\s+/g, ' ');
    expect(heroText).toMatch(/2 de 3 visibles/);

    // Exclusive beta model disappears from EVERY surface — removed, not dimmed.
    for (const id of ['ref-table-mount', 'composite-chart-mount', 'pricing-chart-mount']) {
      const mount = document.querySelector(`#${id}`);
      expect(mount.querySelector('[data-model-key="betaOnly"]')).toBeNull();
      expect(mount.innerHTML).not.toContain('Beta Only');
    }
    for (const id of ['workflow-mount', 'cli-mirror-mount', 'justification-mount']) {
      expect(document.querySelector(`#${id}`).innerHTML).not.toContain('Beta Only');
    }

    // Assignments resolve inside the eligible set; alternatives too.
    const values = Object.values(state.assignments);
    expect(values.every((a) => a.key === 'shared')).toBe(true);
    expect(values[0].alternatives.map((a) => a.key)).toEqual(['alphaOnly']);

    // Workflow still renders 9 rows; CLI 18 rows; justification 18 cards.
    expect(document.querySelectorAll('#workflow-mount tbody tr').length).toBe(9);
    expect(document.querySelectorAll('#cli-mirror-mount tbody tr').length).toBe(18);
    expect(document.querySelectorAll('#justification-mount .justification-card').length).toBe(18);
  });

  test('re-render sobreescribe los mounts: no queda resultado stale', async () => {
    const app = await bootWith(buildSurfaceFixture());
    setEnabledViaEvent(['alpha']);
    expect(document.querySelector('#ref-table-mount').innerHTML).not.toContain('Beta Only');
    // Re-enable both → the beta model comes back through the same entry point.
    setEnabledViaEvent(['alpha', 'beta']);
    expect(app.getState().filterRevision).toBe(3);
    expect(document.querySelector('#ref-table-mount [data-model-key="betaOnly"]')).not.toBeNull();
    expect(document.querySelector('#ref-table-mount').innerHTML).toContain('Beta Only');
  });

  test('el twin gate corre antes de mutar estado visible: el fallo conserva lo previo', async () => {
    const app = await bootWith(buildSurfaceFixture());
    const before = app.getState();
    const beforeEligible = before.eligibleModels;

    // A refresh with divergent judge roles must NOT commit.
    const divergent = buildSurfaceFixture();
    divergent.roles['jd-judge-b'] = { minReasoning: 99, costRatio: 0.0001, role: 'divergente' };
    const result = app.applyData(divergent);

    expect(result.ok).toBe(false);
    expect(app.getState().filterRevision).toBe(before.filterRevision);
    expect(app.getState().eligibleModels).toBe(beforeEligible);
    // The previous visible assignment set is still on the mounts.
    expect(document.querySelector('#workflow-mount').innerHTML).toContain('Shared Model');
  });

  test('applyData (refresh) re-deriva el eligible y re-renderiza el payload nuevo', async () => {
    const app = await bootWith(buildSurfaceFixture());
    const fresh = buildSurfaceFixture();
    fresh.models.extraBeta = {
      name: 'Extra Beta',
      tier: 'budget',
      lifecycle: 'active',
      benchlm: { score: 55, verified: false, reliability: 0.6, categories: {} },
      input: 0.1,
      output: 0.2,
      availability: { alpha: false, beta: true },
    };
    fresh.availability.extraBeta = fresh.models.extraBeta.availability;

    const result = app.applyData(fresh);
    expect(result.ok).toBe(true);
    expect(app.getState().data.models.extraBeta).toBeDefined();
    expect(Object.keys(app.getState().eligibleModels)).toContain('extraBeta');
    expect(document.querySelector('#ref-table-mount [data-model-key="extraBeta"]')).not.toBeNull();
    expect(app.getState().filterRevision).toBe(2);
  });

  test('boot, filter-change y refresh comparten recompute(); no hay click sintético', () => {
    expect(APP_SOURCE).toMatch(/function recompute\(reason\)/);
    expect(APP_SOURCE).toMatch(/recompute\('boot'\)/);
    expect(APP_SOURCE).toMatch(/recompute\('refresh'\)/);
    expect(APP_SOURCE).toMatch(/sdd-provider-filter-change/);
    // The old refresh path re-clicked the active button — gone.
    expect(APP_SOURCE).not.toMatch(/\.click\(\)/);
  });
});
