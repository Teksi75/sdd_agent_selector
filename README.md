# SDD Agent Selector V4

Refactor modular del selector de modelos SDD — monolito V3 → módulos V4 con live data sync.

**Live:** [https://Teksi75.github.io/sdd_agent_selector/](https://Teksi75.github.io/sdd_agent_selector/)
*(placeholder — el primer deploy se activa cuando Pablo habilita GitHub Pages en Settings → Pages → GitHub Actions)*

## Stack

- **Package manager:** pnpm (no npm, no yarn)
- **Bundler:** esbuild ^0.20
- **Tests:** vitest ^1.0 + jsdom ^24
- **CSS:** Tailwind 3.4 + `css/tokens.css` (custom CSS variables sobre Tailwind)
- **Lenguaje UI:** español rioplatense ("vos", "hiciste", "querés")
- **Distribución:** HTML self-contained via esbuild bundle + GitHub Pages
- **Branch:** `main`

## V3 snapshot (referencia visual)

`v3-monolith-backup.html` es la **fuente de verdad visual** de V3. NO se modifica durante el desarrollo de V4 — solo se usa para comparar paridad visual. La fuente original de V3 vive en `../SDD/Modelos SDD - V3 - Lucide.html` (carpeta padre). El snapshot en este repo es byte-identical al original (SHA-256 capturado en `index.html` comment block).

Si necesitás verificar visualmente que V4 mantiene paridad con V3:

```bash
# 1. Servir el repo localmente
python -m http.server 8765 --bind 127.0.0.1
# 2. Abrir en el browser
#    V3: http://127.0.0.1:8765/v3-monolith-backup.html
#    V4: http://127.0.0.1:8765/dist/index.html  (con data/ y assets/ en dist/ para que cargue los JSON)
```

## Desarrollo local

```bash
# Una sola vez — habilita pnpm vía Node corepack
corepack enable

# Instalar dependencias
pnpm install

# Correr los tests (16 files, 129 tests)
pnpm test

# Build de producción — produce dist/index.html (CSS+JS inlined, sin CDN)
pnpm run build

# Watch mode (rebuild automático al editar js/app.js)
pnpm run dev
```

Requisitos: Node.js >= 18 (recomendado 20 LTS), pnpm >= 8.

## Estructura

```
sdd_agent_selector/
├─ index.html              # Shell HTML — placeholders inlined at build time
├─ v3-monolith-backup.html # V3 snapshot (referencia visual, NO modificar)
├─ js/
│  ├─ app.js               # Bootstrap entry (Phase 1+)
│  ├─ components/          # ref-table, config-selector, workflow-table, etc.
│  └─ services/            # data-loader, model-scorer, data-sync
├─ tests/                  # Vitest suite (16 files, 129 tests)
├─ css/tokens.css          # Tailwind layers + V3 custom classes + CSS tokens
├─ assets/icons/*.svg      # Lucide icon set (~33) — V3 visual-parity, static
├─ data/                   # JSON con catálogo de modelos, configs, fases, roles
├─ dist/                   # Output de esbuild (gitignored, single self-contained HTML)
├─ coverage/               # Output de vitest --coverage (gitignored)
├─ verify-report.md        # Phase 5 verification report (16 acceptance criteria)
├─ .github/workflows/
│  ├─ sync-benchmarks.yml  # Phase 3 — auto-sync upstream data every 5 days
│  └─ deploy-pages.yml     # Phase 4 — deploy dist/index.html to GitHub Pages
├─ openspec/
│  ├─ config.yaml          # Reglas globales del SDD engine
│  ├─ specs/
│  │  └─ model-picker/spec.md     # Spec archivada (mergeada 2026-07-05)
│  └─ changes/
│     └─ archive/
│        └─ 2026-07-04-sdd-model-picker-refactor/
│           ├─ proposal.md
│           ├─ design.md
│           ├─ tasks.md
│           └─ state.yaml
├─ esbuild.config.js
├─ tailwind.config.js
├─ vitest.config.js
├─ package.json
├─ .gitignore
└─ README.md
```

## SDD artifacts

Los artefactos de Spec-Driven Development viven en `openspec/`:

- **`openspec/specs/model-picker/spec.md`** — spec activa (merged 2026-07-05). Given/When/Then + RFC 2119 keywords. Esta es la fuente de verdad de qué debe hacer el sistema.
- **`openspec/changes/archive/2026-07-04-sdd-model-picker-refactor/`** — change archivado:
  - `proposal.md` — qué se construyó y por qué (rollback plan incluido).
  - `design.md` — arquitectura, module dependency graph, data flow del sync layer.
  - `tasks.md` — fases 0-4 con dependencias blocking entre tareas (53 tasks, 10 PRs).
  - `state.yaml` — estado final del change (todas las fases: success).
- **`openspec/config.yaml`** — reglas globales (TDD strict, coverage threshold 80%, etc.).

Cualquier cambio a la arquitectura, decisiones técnicas o roadmap debe proponer nuevos specs ahí antes de tocar el código.

## GitHub Pages

La distribución de la app es via GitHub Pages. **Pablo tiene que habilitarlo manualmente** (solo una vez):

1. Ir a `https://github.com/Teksi75/sdd_agent_selector/settings/pages`
2. En **Source**, elegir **GitHub Actions** (NO "Deploy from a branch")
3. Guardar

A partir de ahí, cada `git push origin main` que pase CI va a deployar automáticamente a:

**URL:** `https://Teksi75.github.io/sdd_agent_selector/`

El workflow vive en `.github/workflows/deploy-pages.yml` y ejecuta `pnpm install && pnpm run build` antes de publicar `dist/index.html` (single self-contained file, ~56 KB, 0 CDN refs en runtime).

Build local equivalente:

```bash
pnpm install
pnpm run build           # produce dist/index.html (~56 KB, CSS+JS inlined)
# Abrir dist/index.html en el browser — totalmente offline (sin CDN runtime)
```

### P1 follow-up conocido

El deploy actual sube solo `dist/` (no incluye `data/*.json` ni `assets/icons/*.svg`). El `js/app.js` hace `fetch('data/models.json')` que va a 404 silencioso en producción y cae al fallback "today's date" del freshness badge. Fix recomendado (no implementado todavía): inlinear los JSON en el bundle de esbuild o cambiar el path a upstream `Teksi75/sdd-data`. Ver `verify-report.md` §6.

## Convenciones

- **UI en español rioplatense:** "Cargando...", no "Loading...". "Seleccioná", no "Selecciona". "Listo", no "Ready".
- **TDD strict para lógica:** `model-scorer.js`, data loaders, y cualquier módulo con decisiones de negocio deben escribirse **test primero** (ver `openspec/config.yaml`).
- **Cobertura mínima:** 80% lines, 80% functions, 70% branches, 80% statements (enforced en CI).
- **PR budget:** ≤ 400 líneas por PR (ver `openspec/changes/archive/2026-07-04-sdd-model-picker-refactor/proposal.md`).
- **Conventional commits:** `chore:`, `feat:`, `fix:`, `refactor:`, `test:`, `docs:`. Español para mensajes cuando aplique.
- **Single source of truth:** `openspec/specs/model-picker/spec.md` es la fuente de verdad — el código refleja los specs, no al revés.

## Licencia

MIT — ver `LICENSE`.