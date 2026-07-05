// js/services/data-loader.js
// Phase 1 — fetch + cache the 5 data/*.json files.
//
// Storage shape (sessionStorage, versioned key):
//   {
//     schemaVersion: number,        // must match CURRENT_SCHEMA_VERSION
//     timestamp: number,             // Date.now() when cached
//     data: { models, phases, ... } // the loaded payload
//   }
//
// Behavior (per spec "Data Layer — Models: Scenario Schema-versioned cache
//   invalidation"):
//   - cache HIT (key present, schemaVersion matches) → return cached data
//   - cache MISS / schema mismatch → fetch all 5 files, populate cache,
//     return composed object
//
// The current schemaVersion is 1; bumping it invalidates every existing
// cached entry on next page load. The constant lives at the top so a future
// shape change is a one-line bump + new tests.

/** @type {string} */
export const CACHE_KEY = 'sdd-models-v1';

/** @type {number} - bump to invalidate ALL cached entries. */
const CURRENT_SCHEMA_VERSION = 1;

/** @type {string[]} - the 5 data files this loader fetches, in order. */
const DATA_FILES = Object.freeze([
  'data/models.json',
  'data/phases.json',
  'data/configs.json',
  'data/agent-roles.json',
  'data/agent-request-profiles.json',
]);

/** Mapping from data file path → top-level key in the returned payload. */
const FILE_TO_KEY = Object.freeze({
  'data/models.json': 'models',
  'data/phases.json': 'phases',
  'data/configs.json': 'configs',
  'data/agent-roles.json': 'roles',
  'data/agent-request-profiles.json': 'profiles',
});

/**
 * Each data file on disk has a `{_meta, <payloadKey>: {...}}` shape
 * (where _meta carries lastSynced + schemaVersion). We surface the
 * inner payload object under the same top-level key so callers receive
 * a clean `{models: {glm52: ...}, phases: [...], configs: [...], ...}`
 * instead of having to navigate `_meta` + nested keys each time. The
 * `_meta` block stays on disk and is not surfaced in the runtime
 * payload — its purpose is to drive cache invalidation only.
 */
const FILE_TO_PAYLOAD_KEY = Object.freeze({
  'data/models.json': 'models',
  'data/phases.json': 'phases',
  'data/configs.json': 'configs',
  'data/agent-roles.json': 'roles',
  'data/agent-request-profiles.json': 'profiles',
});

/**
 * Resolve the cache backend (sessionStorage). Returns an object with
 * getItem/setItem/removeItem, or `null` if not available (SSR / tests).
 *
 * @returns {Storage | null}
 */
function cacheBackend() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    // Round-trip a benign value to confirm the backend actually works.
    const probe = '__sdd_probe__';
    sessionStorage.setItem(probe, '1');
    sessionStorage.removeItem(probe);
    return sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Read the cached payload (if any) and return it ONLY if the schema version
 * matches `CURRENT_SCHEMA_VERSION`. A miss / mismatched / corrupted cache
 * all return `null` to trigger a fresh fetch.
 *
 * @returns {Object|null}
 */
function readCache() {
  const backend = cacheBackend();
  if (!backend) return null;
  const raw = backend.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    return parsed.data;
  } catch {
    // Corrupted JSON → force re-fetch.
    return null;
  }
}

/**
 * Persist `data` to sessionStorage under `CACHE_KEY` with the current
 * `schemaVersion` and a `timestamp`. Failures are swallowed — caching is
 * best-effort and must never break the boot path.
 *
 * @param {Object} data
 */
function writeCache(data) {
  const backend = cacheBackend();
  if (!backend) return;
  try {
    backend.setItem(
      CACHE_KEY,
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        timestamp: Date.now(),
        data,
      })
    );
  } catch {
    // quota or serialization error — ignore.
  }
}

/**
 * Fetch a single JSON file. Returns the parsed JSON on 2xx.
 *
 * @param {string} path - relative URL or absolute path
 * @returns {Promise<any>}
 */
async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * In-process singleton — guards against duplicate concurrent fetches when
 * loadAll() is called twice in the same tick (e.g., two components mount
 * simultaneously before the first await resolves).
 *
 * @type {Promise<Object>|null}
 */
let inflight = null;

/**
 * In-memory memo of the composed payload (for reference-equality on
 * subsequent calls). Cleared by clearCache().
 *
 * @type {Object|null}
 */
let inMemory = null;

/**
 * Load the 5 data files. Cache hit returns synchronously-after-await
 * (no fetch). Cache miss / schema mismatch triggers a single round of
 * parallel fetches.
 *
 * The returned shape is the composed payload:
 *   { models: {...}, phases: [...], configs: [...], roles: {...}, profiles: {...} }
 *
 * @returns {Promise<Object>}
 */
export async function loadAll() {
  if (inMemory) return inMemory;
  const cached = readCache();
  if (cached) {
    inMemory = cached;
    return cached;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const results = await Promise.all(DATA_FILES.map(fetchJson));
    /** @type {Object} */
    const composed = {};
    for (let i = 0; i < DATA_FILES.length; i++) {
      const path = DATA_FILES[i];
      const key = FILE_TO_KEY[path];
      const payloadKey = FILE_TO_PAYLOAD_KEY[path];
      const raw = results[i];
      // Extract the inner payload so callers get clean objects.
      //   { _meta: {...}, models: {glm52: ...} } → {glm52: ...}
      //   { _meta: {...}, configs: [{...}] }    → [{...}]
      //   { _meta: {...}, roles: {...} }        → {...}
      composed[key] = raw && typeof raw === 'object' && payloadKey in raw
        ? raw[payloadKey]
        : raw;
    }
    writeCache(composed);
    return composed;
  })();

  try {
    const composed = await inflight;
    inMemory = composed;
    return composed;
  } finally {
    inflight = null;
  }
}

/**
 * Force-evict the cached entry. Useful for tests and for the manual refresh
 * button in Phase 3.
 *
 * @returns {void}
 */
export function clearCache() {
  const backend = cacheBackend();
  if (!backend) return;
  try {
    backend.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
  inMemory = null;
}

/**
 * Invalidate ONLY the in-memory memo, leaving sessionStorage intact.
 *
 * Use this from data-sync.refresh() after writing fresh data to
 * sessionStorage — the next loadAll() call must re-read from
 * sessionStorage (returning the freshly-written payload) instead of
 * returning the stale in-memory memo.
 *
 * @returns {void}
 */
export function invalidateMemoryCache() {
  inMemory = null;
}
