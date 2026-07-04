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
      ],
      // Threshold enforced en CI; umbrales vienen de openspec/config.yaml.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});