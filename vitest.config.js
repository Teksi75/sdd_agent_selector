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