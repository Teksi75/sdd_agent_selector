---
timestamp: 2026-08-01T04-30-00Z
slug: teksi75-github-io-sdd-agent-selector
source: impeccable critique v2 (Assessment A design review + Assessment B detector + manual a11y/perf), dual sub-agent
mode: operate
score: 28 / 40 (Nielsen)
p0_count: 2
p1_count: 2
p2_count: 6
p3_count: 4
target: https://teksi75.github.io/sdd_agent_selector/
commit: 98fc0cd
---

# SDD Agent Selector V4 — Critique Snapshot (2026-08-01, v2)

Validación del sprint que cerró los 20 items P0/P1/P2 del critique 2026-07-31 más KI-1 y KI-2. Estado actual: main @ `98fc0cd`, 371/371 tests verde, live en producción.

## Method

`Method: dual-agent (A: design review · B: detector + a11y/perf) — target slug teksi75-github-io-sdd-agent-selector — commit 98fc0cd`

Assessment A: design director review (heuristics 1-10, design specificity, cognitive load, emotional journey, 3 personas).
Assessment B: CLI detector (`detect.mjs --json`) sobre 17 archivos (1 HTML + 1 CSS + 15 JS), manual a11y/perf check, false-positive triage.

## Headline

Sprint shipped clean: 0 structural / 0 visual regression. The score 28/40 reflects the 2 P0 + 2 P1 + 6 P2 that emerged from the new vantage point — most are user-facing empty-state issues, not design defects. The 4 SLOP findings from the detector are all false positives (Spanish em-dashes, intentional indigo, V3-parity Inter, dead gradient class).

## Heuristics Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2/4 | Empty state wall of 18 red error cards; freshness refresh is silent on boot |
| 2 | Match system / real world | 3/4 | Rioplatense Spanish, product-specific agent keys, correct export target |
| 3 | User control and freedom | 3/4 | 5-button selector is reversible; no "deselect" affordance (acceptable) |
| 4 | Consistency and standards | 3/4 | Amber-300 overloaded (warnings + Sin modelo + soft + freshness) |
| 5 | Error prevention | 2/4 | First state is a wall of 18 red cards; no onboarding to the 5 strategies |
| 6 | Recognition rather than recall | 3/4 | Hero stats, freshness badge, glossary — all visible/one-click; "CLI mirror" is a misnomer |
| 7 | Flexibility and efficiency of use | 3/4 | 5 presets + 3 export formats; no keyboard shortcuts; no per-row copy in CLI mirror |
| 8 | Aesthetic and minimalist design | 3/4 | Dark slate, clean grid, well-spaced; but h2 tier labels are nearly invisible, 18-card red wall dominates first paint |
| 9 | Error recovery | 3/4 | ⚠ icon + 404 toast explain the upstream repo; but per-card "Sin razón especificada" is unhelpful |
| 10 | Help and documentation | 3/4 | 3 disclosure details (Cómo leer, Glosario, Cómo leer las barras); no top-level onboarding |
| **Total** | | **28 / 40** | **Operate mode: solid 70%** |

## Design Specificity Verdict

**Authored-for-this-product.** The h1, the rioplatense voice ("Elegí una estrategia", "revisá la justificación"), the 18 agent keys (`sdd-init`, `sdd-archive`, `jd-judge-a/b`, `review-resilience`), the export target (`gentle-ai/agents/*.md`), the conceptual vocabulary (`BenchLM`, `minReasoning`, `costRatio`, `soft fallback`, twin-judge constraint) are all internal to the SDD / gentle-ai ecosystem. Could not drop into a generic AI leaderboard without rewriting everything.

## P0 — must fix

### P0-1 — Empty state is a sea of 18 red error cards
**What**: First load paints 18 red "Sin modelo elegible" cards with "Sin razón especificada". This is the page's first impression.
**Why it matters**: Teacher persona lands and assumes data is broken → leaves. Power user must click a strategy before the export action works. The `configs.json` literally designates `balanceado` as "punto de partida recomendado" — the design is not implemented.
**Fix**: Pre-select `balanceado` on first load (one line in `app.js` `bootAll`), OR paint an onboarding empty state ("Elegí una estrategia arriba para ver los 18 agentes con modelo") instead of the red wall.

### P0-2 — Hero-stats "0 agentes" data contract bug (LIVE, shipped in PR #46)
**What**: `hero-stats.js` reads `data?.roleMatrix` but `data-loader.js` returns the key as `roles`. Live page shows `0 agentes (0 SDD + 0 JD + 0 review)` instead of `18 agentes (11 SDD + 3 JD + 4 review)`.
**Why it matters**: The micro-stats line is the only always-visible "you are here" signal. It's wrong. A teacher who lands will see "0 agentes" and assume the data is broken.
**Fix**: In `js/components/hero-stats.js`, change `data?.roleMatrix` to `data?.roles` (or accept both: `data?.roleMatrix ?? data?.roles`). Add a runtime shape assertion in `data-loader.js`. Add a test that asserts the live page's hero-stats text contains the agent count.
**Regression risk**: HIGH — this is a regression from a feature just shipped in PR #46. The PR review caught the tests but not the live data shape.

## P1 — should fix

### P1-1 — Tier h2 labels are nearly invisible
**What**: `1 · Acción → resultado`, `2 · Datos de soporte`, `3 · Catálogo completo` are `text-[11px] text-slate-400` — barely scannable on dark bg.
**Why it matters**: The 3-tier IA is the page's organizing principle. Without visible labels, the page reads as one long scroll.
**Fix**: Bump to `text-sm`, use `text-slate-200` with the indigo/slate-400/slate-500 tier distinction preserved.

### P1-2 — SOFT badge reads as an error
**What**: Soft-fallback badge uses amber-300, same hue as warnings + Sin modelo + freshness banner. Only the `title` attribute distinguishes it.
**Why it matters**: 12/18 cards showing "soft" in amber next to a green tier tag looks like a problem to a teacher.
**Fix**: Move the soft-fallback explanation to a top-of-section banner ("12 de 18 usan soft fallback — qué significa") OR use a neutral color (`text-slate-400`).

## P2 — fix when convenient

### P2-1 — Freshness refresh button is a sidecar
The button is in a secondary location with a unicode `↻` icon and 2.5s toast. No tooltip, no "what will this update?" affordance. Add tooltip ("Actualizar desde el repo de datos origen") + consider moving into the page header.

### P2-2 — No skip-to-main-content link
Screen-reader users have to tab through the hero + 2 `<details>` disclosures to reach Tier 1. Add a visually-hidden "Saltar al contenido principal" link at the top of `<body>`.

### P2-3 — Export menu missing keyboard navigation
The export dropdown opens/closes on click and dismisses on Escape, but **no ArrowUp/Down/Home/End** handling. WAI-ARIA Authoring Practices for `role="menu"` requires arrow-key nav. Add roving tabindex + arrow handlers.

### P2-4 — No `aria-live` on per-card model swap
The toast covers "Estrategia aplicada" but per-card model swaps on every `selectConfig()` are silent. Add `aria-live="polite"` on the `#justification-mount` container.

### P2-5 — No description of export formats
A teacher who clicks "Descargar JSON" doesn't know why/when to use JSON vs md. Add a small text or tooltip explaining "JSON: para tooling (gentle-ai). md: para documentar / pegar en Notion."

### P2-6 — "CLI mirror" is a misnomer
The table is HTML, not copy-pasteable code. The actual paste-ready markdown is the export button. Consider renaming to "Tabla de assignments" or "Resumen de agentes".

## P3 — advisory / SLOP

### P3-1 — `ai-color-palette` (false positive)
`text-indigo-300/90` on Tier 1 h2 is the intentional `balanced`-tier accent. Removing breaks the tier color system. 10.6:1 contrast (well above WCAG AA). False positive.

### P3-2 — `em-dash-overuse` (false positive)
14 em-dashes + 2 `--` in 3,930 body-text chars (density 1.78/500). Spanish typography feature, not English AI cadence. Detector calibrated for English prose. Advisory only.

### P3-3 — `overused-font` Inter (false positive)
V3 visual-parity constraint, explicitly fenced off in `tokens.css:49-56` with "DO NOT MODIFY" comment. System-font fallback stack — no @font-face / no external font.

### P3-4 — `gradient-text` dead class
Rule defined in `tokens.css:53` but **never applied** in rendered HTML (0 `class="gradient-text"` in dist). Dead V3-parity class, ~50 bytes wasted.

## Cognitive Load

- 5 strategy buttons at threshold, all single-word. No inline descriptions (only `title` tooltips).
- 3 export format options per section — clean tri-choice.
- 18 agent rows × 2 sections (cli-mirror + justification) — long lists, not single decision point. 3-column card grid on desktop.
- 4 tiers (high/balanced/budget/reference) — within 4-7 visual recognition range. Color + shape prefix (▲●▽◆) dual-encoding is good.
- **Memory state across scrolls**: strategy picked (mitigated by sticky bar + active highlight), soft-fallback count from toast (auto-dismisses in 2.5s), per-card check pass/fail (not re-surfaced after re-render).

## Emotional Journey (peak-end)

- **Onboarding — VALLEY**: 18 red cards on first load → panic trigger. Teacher assumes data is broken.
- **Decision — PEAK**: Click a strategy → emerald toast "Estrategia aplicada: Balanceado (18/18 agentes)" + scroll-to-first-change with 1.4s indigo ring → reassuring.
- **Export — END**: 4 dropdowns, 3 formats each, green toast, date-suffixed filenames → solid.
- **Peak-end summary**: By the rule, the user will remember the page as "the one that started broken". **Fix the empty state.**

## What's Working

1. **Rioplatense Spanish voice is on-brand and product-specific** — "Elegí una estrategia de asignación, revisá la justificación por agente, exportá los 18 assignments y pegá en `gentle-ai/agents/*.md`." Perfect single-sentence onboarding in itself, but the page does not capitalize on it.
2. **3-tier IA correctly named** — "Acción → resultado / Datos de soporte / Catálogo completo". The labels just aren't loud enough.
3. **Export pipeline well-thought-through** — 3 formats × 4 sections × toast feedback × date-suffixed filenames × clipboard fallback. `copyToClipboard` even falls back to hidden textarea + `execCommand` for old browsers.

## Persona Red Flags

**Pablo (teacher, Mendoza, non-developer) — daily selection**
- Lands → 18 red cards → assumes broken → no "report broken" link → closes tab.
- Even scrolling past the red wall, the 5 strategy buttons have no visible "this is the main action" cue.
- Recovery: 4 steps of friction, first one (red sea) is a panic trigger.
- **Red flag**: lede says "Elegí una estrategia" but doesn't point to the buttons (200px further down).

**Data engineer (gentle-ai) — bulk export**
- Lands → CLI mirror shows `0/18 agentes` → must click a strategy first → exports → done.
- **Red flag 1**: 3 formats × 4 sections = 12 buttons, no "export everything" path.
- **Red flag 2**: "CLI" in the name is a misnomer — table is HTML, the actual paste-ready md is the export button.
- **Red flag 3**: the hero-stats "0 agentes" bug is visible on screenshots; if shared, looks broken.

**First-timer from search — figure out what this is**
- Lands → dark page with red cards → reads h1 "Selector de modelos para SDD" → doesn't know what SDD is → doesn't know what gentle-ai is → looks for "Learn more" → leaves.
- **Red flag**: lede assumes context, glossary is collapsed, agent keys have no inline tooltip.

## Run Notes

- **Target slug**: `teksi75-github-io-sdd-agent-selector` (resolved from `https://teksi75.github.io/sdd_agent_selector/`).
- **Detector exit code**: 2 (4 findings). All 4 SLOP. Saved at `.impeccable/assessment-b-detector.json`.
- **Browser visualization**: unavailable (Puppeteer/Playwright not installed in sub-agent). Live URL verified via `web_fetch` (200 OK, 97.4 KB inlined).
- **Trend (first v2 run)**: no prior run for this slug.

## Triage Recommendation

1. **Immediate (1 PR small, ~30 min)** — fix the P0-2 data contract bug + pre-select `balanceado` on first load (P0-1 half). Both are 5-line fixes in `app.js` + `hero-stats.js`. Add a snapshot test for hero-stats so this doesn't regress again.
2. **Same PR** — add skip-to-main link (P2-2) and export menu arrow-key nav (P2-3) since the a11y fixes are small.
3. **Next PR (medium)** — empty state onboarding copy (P0-1 second half) + tier h2 visibility (P1-1) + SOFT badge color (P1-2) + description of export formats (P2-5).
4. **Future** — keyboard shortcuts (P1 efficiency), aria-live per-card (P2-4), CLI mirror rename (P2-6), freshness affordance (P2-1).
