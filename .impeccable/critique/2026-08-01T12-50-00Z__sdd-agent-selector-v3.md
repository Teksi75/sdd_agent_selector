---
timestamp: 2026-08-01T12-50-00Z
slug: teksi75-github-io-sdd-agent-selector
source: impeccable critique v3 (Assessment A design review + Assessment B detector + manual a11y/perf), dual sub-agent
mode: operate
score: 34 / 40 (Nielsen)
p0_count: 0
p1_count: 3
p2_count: 5
p3_count: 3
target: https://teksi75.github.io/sdd_agent_selector/
commit: 08b0f23
---

# SDD Agent Selector V4 — Critique Snapshot (2026-08-01, v3)

Validación del sprint que cerró los 8 items del critique v2. Estado actual:
main @ `08b0f23` (PR #48 merged 2026-08-01), 415/415 tests verde, live en
producción.

## Method

`Method: dual-agent (A: design review · B: detector + a11y/perf) — target slug teksi75-github-io-sdd-agent-selector — commit 08b0f23`

Assessment A: design director review (heuristics 1-10, design specificity,
cognitive load, emotional journey, 3 personas).
Assessment B: CLI detector (`detect.mjs --json`) sobre 1 HTML + 1 CSS + 15 JS,
manual a11y/perf check, false-positive triage.

## Headline

PR #48 closed 8/8 items from v2 backlog (verified at source + live URL level).
Score climbs from 28/40 to **34/40**: a +6 jump distributed across heuristics
1, 4, 5, 6, 7, 8, 10. The remaining gap (34→40) is **3 P1 design issues** and
**5 P2 a11y/cleanup** that emerged from the new vantage point — none are
critical, all are user-facing quality. v2's 4 SLOP false positives (intentional
indigo, Spanish em-dashes, V3-parity Inter, dead `.gradient-text`) remain
defended. **One v3 false positive caught**: Assessment A reported `dist/index.html`
as stale, but ground-truth grep confirms the artifact contains all 8 PR-#48
markers (lines 77, 161, 249, 499). No build-pipeline defect.

## Heuristics Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3/4 | Pre-select closes empty-state valley; skeleton + toast + aria-busy all wired. Gap: pre-select is silent (no "Balanceado active" toast on boot). |
| 2 | Match system / real world | 4/4 | Rioplatense Spanish, product-specific agent keys, accurate export target, shape prefixes (▲●▽◆) for color-blind users. |
| 3 | User control and freedom | 3/4 | 5 reversible presets, skip-link, Esc/click-outside dismissal, sticky bar. Gap: no "compare 2 strategies" or "reset to default". |
| 4 | Consistency and standards | 3/4 | 4-tier color encoding runs through 7 surfaces; soft-badge purple disambiguates from amber warnings; WAI-ARIA menu pattern. Gap: "Sin modelo elegible" still uses `text-amber-300` in cli-mirror (mild overload). |
| 5 | Error prevention | 3/4 | P0-1 2da + P0-2 closed: pre-select + onboarding hint + dual-key data contract. Gap: no progress bar for first fetch. |
| 6 | Recognition rather than recall | 4/4 | Hero micro-stats, freshness badge, glossary, per-card surfaces, sticky bar, per-section export buttons. |
| 7 | Flexibility and efficiency of use | 4/4 | 5 presets × 3 export formats × 4 sections + `?`/`g+i/j/k`/`r`/`Esc` keyboard + roving tabindex + aria-live. |
| 8 | Aesthetic and minimalist design | 3/4 | Dark slate, clean grid, tier h2 now `text-sm` with intentional indigo→slate gradient. Gap: 4 export buttons all look identical from a distance; hero micro-stats line is information-dense without hierarchy; cli-mirror `<h3>` same size as tier `<h2>`. |
| 9 | Error recovery | 3/4 | 4 distinct toast messages per refresh outcome; ⚠ icon + date on stale data; auto-refresh on >7d staleness. Gap: "Sin razón especificada" still in fallback for some cards. |
| 10 | Help and documentation | 4/4 | 2 hero details + onboarding hint + kbd-shortcuts help overlay (printed via `?`) + print stylesheet + prefers-reduced-motion. |
| **Total** | | **34 / 40** | **Operate mode: solid 85%** (up from 28/40 = 70% in v2) |

## Design Specificity Verdict

**Authored-for-this-product.** The 18 agent keys (`sdd-init`, `sdd-archive`,
`jd-judge-a/b`, `review-resilience`), the conceptual vocabulary (`BenchLM`,
`minReasoning`, `costRatio`, `soft fallback`, twin-judge constraint), the
4-tier taxonomy (high/balanced/budget/reference, not the conventional 3-tier),
the export target (`gentle-ai/agents/*.md`), and the rioplatense voice are
all internal to the SDD / gentle-ai ecosystem. Could not drop into a generic
AI leaderboard without rewriting nearly everything.

Minor generic feel: dark slate + indigo is competent but not unique; the
generic "↓ Exportar ▾" pattern is visible in any BI dashboard.

## Deterministic Scan Summary

Detector returned **0 actionable findings** (1 SLOP `ai-color-palette` warning
+ 1 advisory `em-dash-overuse`, both already-classified false positives from
v2). Manual source + dist a11y/perf verification confirms **all 8 PR #48 items
CLOSED with source-level + dist-level evidence**. 415/415 test suite passes
and `pnpm build` produces a 107.5 KB self-contained `dist/index.html` (CDN-free,
inlined CSS+JS, skeleton placeholders for CLS, `prefers-reduced-motion` and
print stylesheets intact).

**8 NEW issues identified (P2-P3)** — none blocking.

## PR #48 Verification (8 items, source + dist)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| P0-1 (2da mitad) | Onboarding `<p>` in hero | ✅ CLOSED | `index.html:75-78`, dist line 77. Auto-hides on first config click. |
| P1-1 | Tier h2 sizing | ✅ CLOSED | `index.html:137,182,219`. All 3 h2s at `text-sm` + tier-distinct colors. |
| P1-2 | SOFT badge color | ✅ CLOSED | `css/tokens.css:286-300` `.soft-badge{color:#d8b4fe}` + `~` prefix. Applied in cli-mirror + justification UI. |
| P2-1 | Refresh button size | ✅ CLOSED | `css/tokens.css:301-306` `.freshness-refresh{min-height:2.25rem; ...}`. (Spec said 2.5rem/40px; impl 2.25rem/36px — 4px short but well above 24px WCAG min.) |
| P2-4 | `aria-live="polite"` on grid | ✅ CLOSED | `justification-ui.js:239`. Confirmed in minified `dist/index.html`. |
| P2-5 | Export menu descriptions | ✅ CLOSED | 12 `description:` strings (3 × 4 sections) rendered via `.export-menu-desc`. |
| P2-6 | "Equivalentes CLI" rename | ✅ CLOSED | `cli-mirror-table.js:230` `<h3>Equivalentes CLI</h3>`. `index.html:159` `aria-label="Equivalentes CLI: 18 agentes"`. Dist line 161 + 499. |
| P2 eficiencia | `?` / `g+i/j/k` / `r` keyboard shortcuts | ✅ CLOSED | `js/components/keyboard-shortcuts.js` (201 lines) wires all 4 with text-entry guard, modifier guard, idempotent mount. Help overlay markup in initial HTML. |

**8/8 closed.** Both the live URL and the committed `dist/index.html` carry
the changes. (Assessment A flagged "dist stale" as P1, but ground-truth grep
in the orchestrator's verification step confirmed the dist artifact is up to
date — that finding is reclassified as a **false positive**.)

## P1 — Priority Issues (3, ordered by impact)

### P1-1 · Hero micro-stats line has no visual hierarchy
**What**: `hero-stats.js:117-151` outputs 7+ inline elements at `text-xs text-slate-400` (`24 activos · 2 reference · 18 agentes (11 SDD + 3 JD + 4 review)`). Same size, same color, no break.
**Why it matters**: A teacher reads the line in 0.5s. The numbers don't tell them what to do next. Visual weight identical to surrounding body copy.
**Fix**: Split into two visual blocks (model counts | agent counts) with a thin vertical divider, bump the `activos` count to `text-slate-100` (headline number), keep the rest at `text-xs text-slate-400`. Optional: anchor each block with a one-character icon.
**Command**: `$impeccable clarify`

### P1-2 · 4 export buttons all look identical
**What**: The 4 export buttons (cli-mirror, justification, composite-chart, ref-table) all render as `<button>↓ Exportar ▾</button>` with no section-distinguishing color or icon.
**Why it matters**: Power users on long-scroll pages can't tell which export is which at a glance. They might be 200px away from the relevant button.
**Fix**: Use the section's existing tier color as the left border (indigo-300/slate-200/slate-300) OR add a one-character icon per section. Both: a visible left edge marker.
**Command**: `$impeccable distinguish`

### P1-3 · No "soft fallback count" summary banner
**What**: After clicking "Experimental" or "Híbrido", 8-12 of 18 cards show a purple `~soft` badge. The teacher has no aggregate to know if 12/18 is "a lot" without counting.
**Why it matters**: Real emotional valley. A teacher who sees 12 soft badges may assume the strategy is broken. Current behavior gives no context.
**Fix**: Top of the justification section, render a one-line summary: "12 de 18 usan soft fallback — esto significa que el rol no tiene un modelo que cumpla minReasoning estricto dentro del cost ceiling. ¿Querés cambiar a Balanceado?" with a link to the Balanceado button.
**Command**: `$impeccable clarify`

## P2 — A11y / Cleanup (5, mix of categories)

### P2-1 · kbd-shortcuts help overlay has no focus trap
**What**: `<div id="kbd-shortcuts-help" role="dialog" aria-modal="true">` shows on `?` press. No focus trap — Tab can leave the dialog into elements behind it. The help `<div class="card">` is the only "focusable" element (close-via-Esc only).
**Why it matters**: `aria-modal="true"` implies modal semantics. WCAG 2.4.3 + WAI-ARIA Authoring Practices require focus containment.
**Fix**: Add a focus trap (move focus to a close button on open, intercept Tab/Shift+Tab to wrap inside the dialog). Or add a close button as the first focusable element.
**Command**: `$impeccable harden`

### P2-2 · cli-mirror `<h3>` is the same size as the tier `<h2>`
**What**: `cli-mirror-table.js:230` `<h3 data-test="cli-mirror-title">Equivalentes CLI</h3>` is `text-sm`. The tier `<h2 id="tier-1-label">` is also `text-sm`. Same font, weight, color.
**Why it matters**: Screen readers walking the heading order see them at the same level. Visual hierarchy is flat where it should be nested.
**Fix**: Bump h3 to `text-xs uppercase tracking-wider font-semibold text-slate-400` (matching the cli-mirror table thead), or add `text-base` to the h2.
**Command**: `$impeccable typeset`

### P2-3 · `aria-activedescendant` set to `''` (empty) before items have ids
**What**: `js/components/export-button.js:199` sets `dropdown.setAttribute('aria-activedescendant', items[0].id || '')` BEFORE the items are given ids (line 204). On first render, the attribute is `""` for one tick, then corrected to the first item's id.
**Why it matters**: Cosmetic but technically incorrect AT state.
**Fix**: Move the `setAttribute` from line 199 to after line 206 (consolidate to one assignment). 1-line change.
**Command**: `$impeccable harden`

### P2-4 · `aria-busy="true"` is never flipped back to `"false"`
**What**: All 5 mounts start with `aria-busy="true"` (`index.html:149,159,168,185,192,201,222`). The mount components overwrite `innerHTML` on render but never set `aria-busy="false"`. The semantic intent ("wait for first paint") is correct on first render but stale afterward.
**Fix**: Each render function should `mountEl.setAttribute('aria-busy','false')` (or remove the attribute) after first successful render. 5 sites.
**Command**: `$impeccable harden`

### P2-5 · `r` key discoverability in help overlay
**What**: The kbd help overlay documents `<kbd>r</kbd> Actualizar datos ahora` but doesn't say "only works when help is closed" or that the user must not be typing in an input.
**Fix**: Add a small note in the help overlay: "Los atajos no funcionan mientras escribís en un input."
**Command**: `$impeccable clarify`

## P3 — Advisory / Cleanup (3)

### P3-1 · `--color-accent` and `--color-accent-hover` tokens are dead
`css/tokens.css:22-23` defines `--color-accent:#6366f1` and `--color-accent-hover:#818cf8` but `grep` shows no `var(--color-accent)` usage in source. ~80 bytes minified waste. Either remove or wire them into `.config-btn.active{border-color:currentColor}`.

### P3-2 · `r` key silent if no freshness button
`keyboard-shortcuts.js:97-100, 155-159` — `triggerRefresh()` queries `button[data-action="refresh"]` and silently does nothing if absent. Other failure paths do `console.warn`. Add `if (!btn) console.warn(...)` for parity.

### P3-3 · Missing `<noscript>` link to home
`<noscript><p>Esta app necesita JavaScript habilitado para funcionar.</p></noscript>` (`index.html:233-235`) offers no path forward. Add a link to the V3 static-monolith backup or a "report a problem" mailto.

## Cognitive Load

- **Strategy picker**: 5 single-word labels + `title=` tooltips. Within Miller's 4-7 range.
- **Export format choice**: 3 per section + 1-line description. Clean tri-choice.
- **18 cards × 2 sections**: long lists, not single decision points. 3-col on `xl`.
- **4 tiers**: color + shape (▲●▽◆) dual-encoding. Within 4-7.
- **Recognition load across scrolls**: strategy (mitigated by sticky + active border). Soft-fallback count: **NOT re-surfaced** → P1-3 fix.
- **One-shot vs. multi-visit**: no localStorage for "last strategy". Predictable default; mild friction for power user.

## Emotional Journey

- **First load — PEAK-START (was VALLEY in v1/v2)**: pre-select + onboarding hint + 18 cards with assignments. Empty-state valley closed.
- **First strategy click — PEAK**: scroll-to-first-change + 1.4s indigo ring on first changed card. Active strategy gets visible border + box-shadow.
- **First export — END**: dropdown with 3 options + descriptions. Date-suffixed filename.
- **Stale data — REASSURANCE**: explicit date + ⚠ icon + 7d warning + refresh button.
- **No-assignment cards — UNRESOLVED VALLEY**: 1-2 cards with "Sin modelo elegible" + "Sin razón especificada" → no path forward. P1-3 partially addresses this.

## What's Working (3 specific strengths)

1. **Pre-select closes the empty-state valley.** P0-1 + P0-2 means first paint shows 18 cards with actual assignments + onboarding hint. The teacher persona's worst-case moment is gone.
2. **Keyboard-shortcut module is thoughtful.** `keyboard-shortcuts.js` excludes text-entry elements, uses a 1.2s timeout for the `g` prefix, ignores modifier-key combinations, only fires `r` when help is closed. Vim-style `g+i/j/k` respects power users without surprising casual users.
3. **Print stylesheet is a quiet win.** `@media print` in `tokens.css:232-267` converts dashboard to B&W single-column report: 3 tiers render, 4 export buttons hide, skeletons hide, dark backgrounds invert.

## Persona Red Flags

### Pablo (teacher, Mendoza, non-developer)
- After picking Híbrido → 11/18 soft badges → no summary → assumes broken → switches to Balanceado. **Fix**: P1-3 summary banner.
- "Datos del 26/07/2026 — hace 6 días" → 1 day from 7d warning → anxious. No proximity reassurance. Minor.
- Color overload: soft=purple ✓, no-model=amber, warning=amber ⚠. 3 amber meanings, 1 purple. Mild.

### Power user (Pablo 2-3 weeks in)
- No "compare 2 strategies side-by-side". Acceptable (5 presets is small).
- No keyboard cycling between strategies (`]` / `[` or `Tab`). Acceptable (sticky bar works).
- No filter by tier or score on the 18-card grid. Acceptable for current scale.
- No cost total of the current strategy. The pricing-chart is per-model, not per-strategy. **What breaks**: the headline value proposition (save money vs quality) requires manual addition. Out of scope.

### Gentle-ai maintainer
- JSON download per section is diff-friendly. ✅
- "NEW" badge per-model exists but hero-stats doesn't show a NEW count. What-changed-since-last-release requires 18-card scan. **What breaks**: at-a-glance "what changed?" → out of scope (Q3 below).

## Questions to Consider

1. **Should the 5 strategy buttons use tier-color tinting to pre-teach the user what each strategy tends to produce?** "Económico" → amber (budget tier), "Máxima calidad" → emerald (high tier), "Híbrido" → indigo. Trade-off: more visual noise on first paint, but action→result link is pre-cognitively obvious. (P1-2 P1-3 both share a "make the visual language self-teaching" sub-theme.)

2. **The cli-mirror table and justification grid show the same 18 agents in the same canonical order. Is the duplication intentional?** A 2-tab UI (Resumen | Justificación) on the same section would let the user toggle without losing scroll position. Probably out of scope for v4.

3. **The page has no "what changed since last release" view.** The freshness badge tells you WHEN, but not WHAT. A `git diff data/models.json` link or a "3 modelos nuevos · 2 precios cambiados · 1 tier reasignado" line in the hero-stats would close the loop. Data is in sessionStorage — a diff would be ~30 lines.

## Recommended Next PR (post user priority)

Given the score already climbed from 28 → 34 in one sprint, a small PR
targeting the 3 P1 items would push to ~37-38/40. The 5 P2 items are a
separate polish PR. P3 is cleanup, defer.

**Recommended single PR** (chained-PR, ~400-line cap):
- P1-1 hero micro-stats hierarchy
- P1-2 export button distinguishers
- P1-3 soft fallback summary banner

**Optional 2nd PR** (a11y/cleanup, ~200 lines):
- P2-1 kbd focus trap
- P2-2 cli-mirror h3 sizing
- P2-3 aria-activedescendant race
- P2-4 aria-busy reset
- P2-5 r key discoverability

## Trend for `teksi75-github-io-sdd-agent-selector` (last 5 runs)

- 2026-07-31: 25/40 (v1)
- 2026-08-01: 28/40 (v2, score after PR #47)
- 2026-08-01: 34/40 (v3, score after PR #48 — this run)

3-run trend: 25 → 28 → 34. The +6 jump from v2 → v3 confirms PR #48's 8 items
landed and the heuristics they're measured against improved in lockstep.
