// vitest.config.js
// Tests en jsdom (necesitamos DOM para componentes y tokens.css).
// Cobertura v8 con umbrales definidos en openspec/config.yaml (≥80%).

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Excluimos del coverage:
      //   - tooling/build configs (esbuild, tailwind) — no son lógica de app
      //   - scripts/** — scrapers offline (correrlos en unit tests pegaría
      //       contra dependencias de red/HTML cambiante; su contrato se
      //       valida por la existencia y formato de data/models.json)
      //   - js/app.js — entry point bootstrap (se cubre con un boot test más
      //       adelante si se vuelve crítico; el refactor Phase 1 lo testea
      //       indirectamente vía data-loader + ref-table)
      //   - vitest.config.js — auto-referencia
      exclude: [
        'node_modules/',
        'esbuild.config.js',
        'tailwind.config.js',
        'vitest.config.js',
        'js/app.js',
        'scripts/**',
      ],
      // Threshold enforced en CI; umbrales vienen de openspec/config.yaml.
      // Lines/statements/functions are spec-mandated at ≥80%. Branches have
      // no spec anchor (and are noisier in JS) — keep them slightly under
      // the lines threshold but with measurable headroom so any local
      // regression in one component shows up clearly instead of mask-failing.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,
        statements: 80,
      },
    },
  },
});