/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './js/**/*.{js,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic colors — los tokens finales viven en tokens.css (Phase 1).
        // Estos son placeholders para que Tailwind compile desde Phase 0.
        'surface': 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'on-surface': 'var(--color-on-surface)',
        'on-surface-muted': 'var(--color-on-surface-muted)',
        'border': 'var(--color-border)',
        'accent': 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'success': 'var(--color-success)',
        'warning': 'var(--color-warning)',
        'danger': 'var(--color-danger)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};