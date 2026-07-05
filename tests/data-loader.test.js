// tests/data-loader.test.js
// Phase 1 — data-loader service TDD (RED stage).
//
// Three scenarios (per design.md "Cache layer" + tasks.md 1.28):
//   1. Cache HIT  → no fetch, returns cached payload (parses sessionStorage).
//   2. Cache MISS → fetches all 5 data/*.json files, returns composed object.
//   3. Schema mismatch → discards cache when schemaVersion changes.
//
// We mock globalThis.fetch + sessionStorage so the test stays pure.

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';

class FakeStorage {
  constructor(initial = {}) {
    this.store = { ...initial };
  }
  getItem(k) {
    return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] ?? null;
  }
}

const freshFiles = {
  'data/models.json': {
    _meta: { schemaVersion: 1, lastSynced: '2026-07-04' },
    models: { glm52: { name: 'GLM-5.2' } },
  },
  'data/phases.json': {
    _meta: { schemaVersion: 1 },
    phases: [{ id: 'init', name: 'sdd-init' }],
  },
  'data/configs.json': {
    _meta: { schemaVersion: 1 },
    configs: [{ key: 'economico', strategy: 'min-cost' }],
  },
  'data/agent-roles.json': {
    _meta: { schemaVersion: 1 },
    roles: { 'gentle-orchestrator': { minReasoning: 95, costRatio: 1.0 } },
  },
  'data/agent-request-profiles.json': {
    _meta: { schemaVersion: 1 },
    profiles: { 'gentle-orchestrator': { inputTokens: 4000, outputTokens: 2000 } },
  },
};

function mockFetch(files) {
  globalThis.fetch = vi.fn(async (url) => {
    const urlStr = typeof url === 'string' ? url : url?.url ?? String(url);
    const path = urlStr.replace(/^https?:\/\/[^/]+\//, '/').replace(/^\//, '');
    if (!files[path]) {
      return { ok: false, status: 404, statusText: 'Not Found' };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(files[path]));
      },
      async text() {
        return JSON.stringify(files[path]);
      },
    };
  });
}

describe('data-loader — cache MISS (fetch all 5 files)', () => {
  beforeEach(async () => {
    globalThis.sessionStorage = new FakeStorage();
    mockFetch(freshFiles);
    // Reset module-level cache from any previous test.
    vi.resetModules();
    const mod = await import('../js/services/data-loader.js');
    mod.clearCache();
  });
  afterEach(() => {
    delete globalThis.sessionStorage;
    delete globalThis.fetch;
  });

  test('returns composed object with all 5 data files', async () => {
    const { loadAll, CACHE_KEY } = await import('../js/services/data-loader.js');
    expect(typeof CACHE_KEY).toBe('string');
    expect(CACHE_KEY).toMatch(/^sdd-models-v/);

    const data = await loadAll();
    expect(data).toHaveProperty('models');
    expect(data).toHaveProperty('phases');
    expect(data).toHaveProperty('configs');
    expect(data).toHaveProperty('roles');
    expect(data).toHaveProperty('profiles');
    // data-loader surfaces the INNER payload (extracts the `<payloadKey>`
    //   out of `{_meta, <payloadKey>: ...}`), so callers get clean shapes:
    //     data.models    = {glm52: {name: 'GLM-5.2'}}
    //     data.configs   = [{key: 'economico', ...}]
    //     data.roles     = {'gentle-orchestrator': {...}}
    //     data.profiles  = {'gentle-orchestrator': {...}}
    //     data.phases    = [{id: 'init', ...}]
    expect(data.models.glm52.name).toBe('GLM-5.2');
    expect(data.configs[0].key).toBe('economico');
    expect(data.roles['gentle-orchestrator'].minReasoning).toBe(95);
    expect(data.profiles['gentle-orchestrator'].inputTokens).toBe(4000);
    expect(data.phases[0].id).toBe('init');
  });

  test('populates sessionStorage with a versioned cache entry', async () => {
    const { loadAll, CACHE_KEY } = await import('../js/services/data-loader.js');
    await loadAll();
    const cached = sessionStorage.getItem(CACHE_KEY);
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached);
    expect(parsed).toHaveProperty('schemaVersion', 1);
    expect(parsed).toHaveProperty('data');
  });

  test('makes exactly 5 fetch calls', async () => {
    const { loadAll } = await import('../js/services/data-loader.js');
    await loadAll();
    expect(globalThis.fetch).toHaveBeenCalledTimes(5);
  });
});

describe('data-loader — cache HIT (no fetch)', () => {
  beforeEach(async () => {
    globalThis.sessionStorage = new FakeStorage();
    mockFetch(freshFiles);
    vi.resetModules();
    const mod = await import('../js/services/data-loader.js');
    mod.clearCache();
  });
  afterEach(() => {
    delete globalThis.sessionStorage;
    delete globalThis.fetch;
  });

  test('second call within same session uses cache', async () => {
    const { loadAll } = await import('../js/services/data-loader.js');
    const first = await loadAll();
    expect(globalThis.fetch).toHaveBeenCalledTimes(5);

    const second = await loadAll();
    // No additional fetches on cache hit.
    expect(globalThis.fetch).toHaveBeenCalledTimes(5);
    expect(second.models).toEqual(first.models);
  });

  test('cache hit returns the SAME object reference (singleton)', async () => {
    const { loadAll } = await import('../js/services/data-loader.js');
    const first = await loadAll();
    const second = await loadAll();
    expect(second).toBe(first);
  });
});

describe('data-loader — schema mismatch (discard cache)', () => {
  beforeEach(async () => {
    globalThis.sessionStorage = new FakeStorage();
    mockFetch(freshFiles);
    // Reset module-level cache from any previous test (the in-memory
    //   `inMemory` singleton must be cleared or stale payloads short-circuit
    //   the first loadAll() call and the schema-mismatch fetch never fires).
    vi.resetModules();
    const mod = await import('../js/services/data-loader.js');
    mod.clearCache();
  });
  afterEach(() => {
    delete globalThis.sessionStorage;
    delete globalThis.fetch;
  });

  test('caches schemaVersion 2 → first call discards and refetches', async () => {
    const { loadAll, CACHE_KEY } = await import('../js/services/data-loader.js');

    // Pre-seed sessionStorage with schemaVersion: 2 (newer than the loader
    //   expects); the loader must discard and re-fetch.
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        timestamp: Date.now(),
        data: { shouldNotBeUsed: true },
      })
    );

    const data = await loadAll();
    // Cached entry was discarded → fetch went out.
    expect(globalThis.fetch).toHaveBeenCalled();
    // The resulting data must come from the freshly-fetched files.
    expect(data.models.glm52.name).toBe('GLM-5.2');
    expect(data.shouldNotBeUsed).toBeUndefined();
    // The sessionStorage was repopulated with the fresh payload.
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    expect(cached.schemaVersion).toBe(1);
  });

  test('older schemaVersion (e.g., 0) is also discarded', async () => {
    const { loadAll, CACHE_KEY } = await import('../js/services/data-loader.js');

    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        schemaVersion: 0,
        timestamp: 0,
        data: { stale: true },
      })
    );

    const data = await loadAll();
    expect(data.stale).toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  test('corrupted cache JSON is discarded gracefully', async () => {
    const { loadAll, CACHE_KEY } = await import('../js/services/data-loader.js');

    sessionStorage.setItem(CACHE_KEY, 'not-json::{{{}');

    const data = await loadAll();
    expect(data).toHaveProperty('models');
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});

describe('data-loader — fetch failure', () => {
  test('fetch error rejects and bubble up (no silent fallback yet)', async () => {
    globalThis.sessionStorage = new FakeStorage();
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('network down');
    });

    const { loadAll } = await import('../js/services/data-loader.js?fail=' + Date.now());
    await expect(loadAll()).rejects.toThrow(/network|fetch|TypeError/i);
  });
});
