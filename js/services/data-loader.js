// js/services/data-loader.js
// Phase 1 — fetch + cache the 6 data/*.json files (incl. the V5 registry).
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
//   - cache MISS / schema mismatch → fetch all 6 files, populate cache,
//     return composed object
//
// The current schemaVersion is 5 (V5 catalog + provider registry join);
// bumping it invalidates every existing cached entry on next page load.
// The constant lives at the top so a future shape change is a one-line
// bump + new tests.

/** @type {string} */
// v6 invalidates cached catalog after the AA effort schema v4 migration,
// lifecycle/reference-table, and curated scraper data corrections (post-v4
// ref-table ordering, legacy filtering, and updated model lifecycle/tier values).
export const CACHE_KEY = 'sdd-models-v6';

/** @type {string[]} - frozen list of prior cache keys to fall back to. */
export const LEGACY_CACHE_KEYS = Object.freeze(['sdd-models-v5', 'sdd-models-v4', 'sdd-models-v3', 'sdd-models-v2']);

/** @type {number} - bump to invalidate ALL cached entries.
 *  Exported as a test affordance so the integrity suite can pin the
 *  migration number. Consumers MUST NOT branch on this value — only
 *  the data shape (and `data/models.json` `_meta.schemaVersion`) are
 *  part of the contract.
 *  History: 1 → 2 (BenchLM migration, PR1 of benchlm-replace-custom-scoring);
 *           2 → 3 (AA pricing schema v3, PR4 of aa-benchmark-integration —
 *           adds blended/pricingSource/term/codingIndex/speed fields);
 *           3 → 4 (AA effort schema v4, PR3 of aa-benchmark-integration —
 *           adds first-class effort variants);
 *           4 → 5 (V5 subscription selector — sixth providers.json file,
 *           registry gate + availability join envelope).
 */
export const CURRENT_SCHEMA_VERSION = 5;

/**
 * The 6 data files this loader fetches, in order, as `[path, payloadKey]`.
 * Exported (V5) because `data-sync.js` MUST refresh the exact same set —
 * a single descriptor prevents the loader/refresh 5-vs-6 drift.
 *
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const DATA_FILES = Object.freeze([
  ['data/models.json', 'models'],
  ['data/providers.json', 'providers'],
  ['data/phases.json', 'phases'],
  ['data/configs.json', 'configs'],
  ['data/agent-roles.json', 'roles'],
  ['data/agent-request-profiles.json', 'profiles'],
]);

/** Registry record contract (design "Registry normativo"). */
const PROVIDER_FIELDS = Object.freeze(['id', 'name', 'tier', 'url', 'updated']);

/** Validate `data/providers.json`: schema 1, non-empty, unique ids, exact 5-field records. */
function isValidRegistry(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (!raw._meta || raw._meta.schemaVersion !== 1) return false;
  const providers = raw.providers;
  if (!Array.isArray(providers) || providers.length === 0) return false;
  const ids = new Set();
  for (const record of providers) {
    if (!record || typeof record !== 'object') return false;
    const keys = Object.keys(record);
    if (keys.length !== PROVIDER_FIELDS.length) return false;
    if (!PROVIDER_FIELDS.every((field) => keys.includes(field))) return false;
    if (typeof record.id !== 'string' || record.id.length === 0 || ids.has(record.id)) return false;
    ids.add(record.id);
  }
  return true;
}

/**
 * Validate + compose the raw fetched files into the runtime payload.
 * Shared by `loadAll()` and `data-sync.refresh()` so both consume the same
 * descriptor and the same gates. Throws BEFORE any cache write when a
 * source schema or the registry is invalid.
 *
 * @param {any[]} results - raw JSON bodies, one per DATA_FILES entry in order
 * @returns {{data: Object, sourceSchemaVersions: {models: number, providers: number}}}
 */
export function composePayload(results) {
  const composed = {};
  const raws = {};
  for (let i = 0; i < DATA_FILES.length; i++) {
    const key = DATA_FILES[i][1];
    const raw = results[i];
    raws[key] = raw;
    // Extract the inner payload so callers get clean objects:
    //   { _meta, models: {glm52: ...} } → {glm52: ...}
    //   { _meta, configs: [{...}] }     → [{...}]
    composed[key] = raw && typeof raw === 'object' && key in raw ? raw[key] : raw;
  }
  const modelsSchema = raws.models && raws.models._meta ? raws.models._meta.schemaVersion : null;
  if (modelsSchema !== 5) {
    throw new Error(`data-loader: data/models.json schemaVersion must be 5, got ${modelsSchema}`);
  }
  if (!isValidRegistry(raws.providers)) {
    throw new Error(
      'data-loader: data/providers.json registry validation failed (schemaVersion 1, unique ids, exact {id,name,tier,url,updated} records)'
    );
  }
  // availability[modelId] = model.availability — no inference, no defaults.
  const availability = {};
  for (const modelId of Object.keys(composed.models || {})) {
    availability[modelId] = composed.models[modelId].availability;
  }
  composed.availability = availability;
  return { data: composed, sourceSchemaVersions: { models: 5, providers: 1 } };
}

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
function readCacheEntry(backend, key) {
  const raw = backend.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    // V5: a cached envelope without the registry join can never satisfy the
    // runtime contract — discard it and re-fetch (no silent availability).
    if (!parsed.data.providers || typeof parsed.data.providers !== 'object') return null;
    if (!parsed.data.availability || typeof parsed.data.availability !== 'object') return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function readCache() {
  const backend = cacheBackend();
  if (!backend) return null;
  return readCacheEntry(backend, CACHE_KEY);
}

function readLegacyFallback() {
  const backend = cacheBackend();
  if (!backend) return null;
  for (const legacyKey of LEGACY_CACHE_KEYS) {
    const legacy = readCacheEntry(backend, legacyKey);
    if (legacy) return legacy;
  }
  return null;
}

/**
 * Persist `data` to sessionStorage under `CACHE_KEY` with the current
 * `schemaVersion` and a `timestamp`. Failures are swallowed — caching is
 * best-effort and must never break the boot path.
 *
 * @param {Object} data
 */
function writeCache(data, sourceSchemaVersions) {
  const backend = cacheBackend();
  if (!backend) return;
  try {
    backend.setItem(
      CACHE_KEY,
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sourceSchemaVersions,
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
 * Generation counter — incremented by `invalidateMemoryCache()` so an
 * in-flight `loadAll()` that resolves AFTER an invalidation can detect it
 * and skip its `inMemory` + `sessionStorage` writes. Without this, the
 * `await inflight` continuation in the original loader could (a) resolve
 * to `null` because `inflight` was set to `null` mid-flight, and (b)
 * overwrite a fresh inMemory memo that a concurrent `dataSync.refresh()`
 * + read path just established.
 *
 * @type {number}
 */
let loadGeneration = 0;

/**
 * Load the 6 data files. Cache hit returns synchronously-after-await
 * (no fetch). Cache miss / schema mismatch triggers a single round of
 * parallel fetches.
 *
 * The returned shape is the composed payload:
 *   { models: {...}, providers: [...], availability: {...},
 *     phases: [...], configs: [...], roles: {...}, profiles: {...} }
 *
 * Invalidation safety: each loader call captures the current
 * `loadGeneration`; if `invalidateMemoryCache()` runs while the fetch is
 * in flight (e.g., a concurrent `dataSync.refresh()` wrote fresh JSON to
 * sessionStorage and cleared the memo), the in-flight continuation
 * detects the generation bump and (a) skips `writeCache` so the fresh
 * sessionStorage entry is preserved, (b) skips `inMemory = composed` so
 * the fresh memo is preserved, and (c) only clears `inflight` if it's
 * still the promise this call created. The local `myInflight` capture
 * keeps the original `await` pointing at the actual Promise even if the
 * module-level `inflight` slot has been reset to `null`.
 *
 * @returns {Promise<Object>}
 */
export async function loadAll() {
  if (inMemory) return inMemory;
  const myGeneration = loadGeneration;
  const cached = readCache();
  if (cached) {
    // An invalidation between readCache() and the inMemory write would
    // re-promote stale data — guard with the generation check.
    if (myGeneration !== loadGeneration) return cached;
    inMemory = cached;
    return cached;
  }
  const legacyFallback = readLegacyFallback();
  if (inflight) {
    try {
      return await inflight;
    } catch (err) {
      if (legacyFallback) return legacyFallback;
      throw err;
    }
  }

  // Local capture so an `invalidateMemoryCache()` mid-flight that sets
  // the module-level `inflight = null` cannot turn the `await` below
  // into `await null` (which would resolve to `undefined`).
  const myInflight = (async () => {
    const results = await Promise.all(DATA_FILES.map(([path]) => fetchJson(path)));
    // Validate + compose (extracts inner payloads, checks the models and
    // registry source schemas, builds `availability` with no inference).
    const { data: composed, sourceSchemaVersions } = composePayload(results);
    // Only persist to sessionStorage if no invalidation happened during
    // the fetch — otherwise we'd overwrite fresh data with stale.
    if (myGeneration === loadGeneration) writeCache(composed, sourceSchemaVersions);
    return composed;
  })();
  inflight = myInflight;

  try {
    const composed = await myInflight;
    // Skip the inMemory memo write if we were invalidated during the
    // await — the fresh inMemory (if any) wins.
    if (myGeneration === loadGeneration) inMemory = composed;
    return composed;
  } catch (err) {
    if (legacyFallback) return legacyFallback;
    throw err;
  } finally {
    // Only clear `inflight` if it's still ours — a newer loadAll() may
    // have replaced it with its own Promise in the meantime.
    if (inflight === myInflight) inflight = null;
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
    for (const legacyKey of LEGACY_CACHE_KEYS) {
      backend.removeItem(legacyKey);
    }
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
 * Race protection: also clears `inflight` and bumps `loadGeneration` so
 * any in-flight `loadAll()` continuation can detect it was invalidated
 * and skip its inMemory + sessionStorage writes (preventing stale data
 * from overwriting fresh data set by a concurrent refresh + read path).
 *
 * @returns {void}
 */
export function invalidateMemoryCache() {
  inMemory = null;
  inflight = null;
  loadGeneration += 1;
}
