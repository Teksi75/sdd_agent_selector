/**
 * @file js/app.js
 * @description SDD Agent Selector V4 — bootstrap entry point.
 *
 * Este archivo es el entry point mínimo de Phase 0 (tooling foundation).
 * En Phase 1+ se reemplaza por un módulo que monta componentes, lee data/*.json
 * y aplica tokens desde css/tokens.css.
 *
 * Fuente de verdad (single source of truth):
 *   openspec/changes/2026-07-04-sdd-model-picker-refactor/
 *     ├─ proposal.md   — qué se está construyendo y por qué
 *     ├─ design.md     — arquitectura y module dependency graph
 *     ├─ tasks.md      — fases 0-4 con dependencias blocking
 *     ├─ state.yaml    — estado vivo del change (SDD engine)
 *     └─ specs/model-picker/spec.md — Given/When/Then scenarios (RFC 2119)
 *
 * Convenciones de stack:
 *   - pnpm (NO npm/yarn)
 *   - esbuild como bundler
 *   - Tailwind 3.4 + tokens.css custom (Phase 1)
 *   - vitest + jsdom para tests
 *   - TDD strict para módulos con lógica (model-scorer.js, etc.)
 */

// Boot signal — útil para confirmar que el bundle cargó en orden correcto.
console.log('SDD Agent Selector V4 — boot');

// En Phase 1 esto se reemplaza por:
//   import { mountApp } from './components/app.js';
//   import '../css/tokens.css';
//   mountApp(document.getElementById('app'));