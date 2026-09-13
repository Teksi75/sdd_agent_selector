// tests/fixtures/v5-surfaces-fixture.js
// Shared deterministic fixture for the V5 Slice 3 surface tests
// (tests/app-filter.test.js + tests/provider-filter-integration.test.js).
//
// Two providers, four models:
//   - ref       reference ancla (cost ceiling) · disponibilidad alpha+beta
//   - shared    activo, disponible en alpha + beta (provider compartido)
//   - alphaOnly activo, exclusivo de alpha
//   - betaOnly  activo, exclusivo de beta
//
// The fixture is intentionally lifecycle-clean (3 activos + 1 reference) so
// the hero counter is `X de 3 visibles` and every surface has a stable,
// minimal universe. No production code imports this file.

export const FIXTURE_PROVIDERS = Object.freeze([
  {
    id: 'alpha',
    name: 'Alpha',
    tier: 'A',
    url: 'https://alpha.example/pricing',
    updated: '2026-09-12',
  },
  {
    id: 'beta',
    name: 'Beta',
    tier: 'B',
    url: 'https://beta.example/pricing',
    updated: '2026-09-12',
  },
]);

export const FIXTURE_AGENTS = Object.freeze([
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
  'jd-judge-a',
  'jd-judge-b',
  'jd-fix-agent',
  'review-risk',
  'review-readability',
  'review-reliability',
  'review-resilience',
]);

/** 9 core SDD phases keyed by the bare id used by data/phases.json. */
export const FIXTURE_PHASES = Object.freeze([
  { id: 'init', name: 'Init', desc: 'Inicialización' },
  { id: 'explore', name: 'Explore', desc: 'Exploración' },
  { id: 'propose', name: 'Propose', desc: 'Propuesta' },
  { id: 'spec', name: 'Spec', desc: 'Especificación' },
  { id: 'design', name: 'Design', desc: 'Diseño' },
  { id: 'tasks', name: 'Tasks', desc: 'Tareas' },
  { id: 'apply', name: 'Apply', desc: 'Implementación' },
  { id: 'verify', name: 'Verify', desc: 'Verificación' },
  { id: 'archive', name: 'Archive', desc: 'Archivo' },
]);

/** 5 configs mirroring data/configs.json keys/strategies. */
export const FIXTURE_CONFIGS = Object.freeze([
  { key: 'economico', name: 'Económico', strategy: 'min-cost' },
  { key: 'balanceado', name: 'Balanceado', strategy: 'balanced' },
  { key: 'maximo', name: 'Máxima calidad', strategy: 'max-quality' },
  { key: 'hibrido', name: 'Híbrido (tier-based)', strategy: 'tier-based' },
  { key: 'experimental', name: 'Experimental', strategy: 'experimental' },
]);

/**
 * Build the composed payload the loader would return (models + availability
 * + providers + roles + profiles + phases + configs).
 */
export function buildSurfaceFixture() {
  const models = {
    ref: {
      name: 'Ref Model',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} },
      input: 5,
      output: 25,
      availability: { alpha: true, beta: true },
    },
    shared: {
      name: 'Shared Model',
      tier: 'high',
      lifecycle: 'active',
      benchlm: { score: 85, verified: true, reliability: 0.9, categories: {} },
      input: 4,
      output: 20,
      availability: { alpha: true, beta: true },
    },
    alphaOnly: {
      name: 'Alpha Only',
      tier: 'balanced',
      lifecycle: 'active',
      benchlm: { score: 70, verified: true, reliability: 0.8, categories: {} },
      input: 0.5,
      output: 1,
      availability: { alpha: true, beta: false },
    },
    betaOnly: {
      name: 'Beta Only',
      tier: 'budget',
      lifecycle: 'active',
      benchlm: { score: 60, verified: false, reliability: 0.7, categories: {} },
      input: 0.1,
      output: 0.2,
      availability: { alpha: false, beta: true },
    },
  };
  const availability = {};
  for (const id of Object.keys(models)) availability[id] = models[id].availability;

  const roles = {};
  for (const agent of FIXTURE_AGENTS) {
    roles[agent] = { minReasoning: 40, costRatio: 1.0, role: `rol de ${agent}` };
  }
  const profiles = {};
  for (const agent of FIXTURE_AGENTS) {
    profiles[agent] = { inputTokens: 1000, outputTokens: 500 };
  }

  return {
    providers: FIXTURE_PROVIDERS.map((p) => ({ ...p })),
    models,
    availability,
    phases: FIXTURE_PHASES.map((p) => ({ ...p })),
    configs: FIXTURE_CONFIGS.map((c) => ({ ...c })),
    roles,
    profiles,
  };
}

/** All enabled provider ids, in registry order. */
export function allProviderIds() {
  return FIXTURE_PROVIDERS.map((p) => p.id);
}
