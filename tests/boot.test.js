// tests/boot.test.js
// Phase 0 smoke test — verifica que vitest corre en jsdom antes de empezar
// a escribir lógica real. Reemplazar/expandir en Phase 1.

import { test, expect } from 'vitest';

test('vitest corre en jsdom', () => {
  // Trivial pero útil: confirma que el runner está vivo.
  expect(1 + 1).toBe(2);
});