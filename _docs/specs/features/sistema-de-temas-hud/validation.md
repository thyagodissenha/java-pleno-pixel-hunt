# Sistema de Temas de HUD Validation

**Date**: 2026-08-30
**Spec**: `_docs/specs/features/sistema-de-temas-hud/spec.md`
**Diff range**: `31195af..9c0f33f` (13 commits; branch `study/hud-redesign`)
**Verifier**: independent sub-agent (author ≠ verifier)

> Verification ran in an isolated detached-HEAD worktree (`git worktree add --detach ... 9c0f33f`) checked out from the diff's HEAD commit, with `node_modules` symlinked from the primary checkout. The primary repo/branch state was never touched. A second throwaway worktree at `31195af` (pre-feature) was used only to get the "before" test count, then removed.

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `lib/theme/theme-cookie.ts` + tests |
| T2   | ✅ Done | `lib/theme/use-theme-preference.ts` + tests |
| T3   | ✅ Done | `app/_hud/hud-props.ts` |
| T4   | ✅ Done | `ClassicHud.tsx` extracted; `classic.css` created then removed in T7 (documented SPEC_DEVIATION, confirmed redundant vs `globals.css`) |
| T5   | ✅ Done | `NeonHud.tsx` + `neon.css` ported |
| T6   | ✅ Done | theme state, settings state, 6 neon-only fields wired in `app/page.tsx` |
| T7   | ✅ Done | `app/page.tsx` return is now dispatch-only (verified, see below); 5-item menu remap confirmed |
| T8   | ✅ Done | Settings panel (theme picker + volume) in both themes |
| T9   | ✅ Done | Persistence/fallback tests in `theme-selector.test.tsx` |
| T10  | ✅ Done | README updated, lint/build/test gate green |

All 10 tasks marked complete in `tasks.md`; none blocked or partial.

---

## Spec-Anchored Acceptance Criteria

### P1: Separar apresentação do motor sem duplicar o motor

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| THEME-01: HudProps carries all state/handlers, theme components implement no game rules | Single `HudProps` type, no game-rule logic in `ClassicHud`/`NeonHud` | `app/_hud/hud-props.ts:10-73` (interface); `app/page.tsx:2012-2071` (single `hudProps` object build) | ✅ PASS |
| THEME-02: theme rendered from `app/page.tsx` dispatch | `theme === "neon" ? <NeonHud/> : <ClassicHud/>` | `app/page.tsx:2072` — `return theme === "neon" ? <NeonHud {...hudProps} /> : <ClassicHud {...hudProps} />;` — corroborated by `app/__tests__/hud-layout.test.tsx:271-286` (`.qwen-hud-canvas` absent/present per cookie) | ✅ PASS |
| THEME-03: `app/page.tsx` return contains only hudProps + dispatch + canvas, no inline topbar/menu JSX | Zero inline topbar/bottombar/menu JSX in the route file | `app/page.tsx:2012-2073` — return statement is exactly the `hudProps` object literal followed by the ternary dispatch; no `<header>`/`<canvas>`/menu JSX inline (canvas moved into `ClassicHud`/`NeonHud` via `canvasRef`, per T7 SPEC_DEVIATION) | ✅ PASS |
| THEME-04: `npm run build` passes without AD-008 violations (`HudProps`/cookie helpers/hook live outside `app/page.tsx`) | Build succeeds; only `export default function Home()` in `app/page.tsx` | Build gate output (below) — `✓ Compiled successfully`; `grep -n "export " app/page.tsx` → only line 226 (`export default function Home()`) | ✅ PASS |

### P1: Tema Clássico e tema Neon consomem o mesmo motor

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| THEME-05: Classic renders like the published game (DOM/CSS, no HUD canvas) | No `.qwen-hud-canvas` in Classic | `app/__tests__/hud-layout.test.tsx:271-277` — `expect(document.querySelector(".qwen-hud-canvas")).not.toBeInTheDocument()` | ✅ PASS |
| THEME-06: Neon header/footer are canvas-drawn (`PixelHUD`/`PixelFooter`), reflecting real state (HP, Rajada, Poder, Score, boss, build, terminal, avatar Doom-style) | Canvas header/footer present, fed by `HudProps` | `app/_hud/neon/NeonHud.tsx:141-151` (`waitForLib`, `new window.PixelHUD()`/`new window.PixelFooter()`) + `:169` (`hurtTimer: damageFlash / 60`) + `:172-179` (footer fed by `bossEncountered`/`boss`/`bossKillsCount`/`bossKillTargetCount`/`bossIncident`); avatar 4-state logic in `public/qwen-hud-lib.js:116-121` (`hp<=0`→dead, `hurtTimer>0.3`→pain, `hurtTimer>0`→hurt, else normal); test: `hud-layout.test.tsx:279-286` (`.qwen-hud-canvas`/`.qwen-footer-canvas` present when cookie=neon) | ✅ PASS |
| THEME-07: Neon menu/HighScores/HowToPlay/Support/Pause/CharacterSelect/Debug use CRT style (`frame-panel`, scanline) | CSS applies frame-panel/scanline treatment to those screens | `app/_hud/neon/NeonHud.tsx:206-208` (`frameScreen = supportScreen \|\| settingsScreen \|\| finalScreen \|\| promotionScreen \|\| (menuScreen && menuPanel !== "home")`); `app/_hud/neon/neon.css:196` groups `.frame-screen, .pause-menu-overlay` and `:207` groups `.frame-panel, .score-panel, .pause-panel` under the same CRT rules — pause uses a distinct class name (`.pause-panel`) but is styled identically via the shared selector | ✅ PASS (note: pause panel achieves CRT parity via shared CSS selector, not literal `frame-panel` class — visual outcome matches spec intent) |
| THEME-08: Title screen uses the frameless variant validated in the study | No `frame-panel` wrapper on title screen | `app/_hud/neon/NeonHud.tsx:206-208` — `frameScreen` excludes `menuScreen && menuPanel === "home"`; title JSX (`:251-267`) uses `menu-overlay-full`, not `frame-panel` | ✅ PASS |
| THEME-09: switching themes preserves in-progress run state (score/wave/hp) | Only presentation changes on theme switch | Design/architecture: `hudProps` is built once per render from state owned solely by `app/page.tsx`; theme switch only changes which component reads the same object — no game state is reset by `setTheme`. Not directly asserted by a dedicated "switch mid-value-preserved" test (settings panel is only reachable from the home menu per Out-of-Scope, so no active-run scenario exists to test) | ⚠️ Spec-precision gap — architecturally sound (state never touches `setTheme`) but no test asserts score/hp survive a live theme switch, because the spec's own edge case says this path is unreachable outside the menu in this version |
| THEME-09b (edge case parity: every action available in both themes) | Mute/pause/highscores/support reachable in both themes | `app/__tests__/hud-layout.test.tsx:288-298` — clicks "High Scores" and "Apoie o jogo" menu items under Neon theme, asserts dialogs become visible | ✅ PASS |

### P1: Tela de Configurações

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| THEME-10: "Configurações" is 3rd menu item, keyboard+click navigable | 5 items, index 2 = Configurações | `app/_hud/classic/ClassicHud.tsx:261-270` (button, `activateMenuOption(2)`); `app/page.tsx:1179-1190` (`% 5` wrap-around); `app/__tests__/hud-layout.test.tsx:155-166` — `expect(screen.getAllByRole("menuitem")).toHaveLength(5)` and asserts label order | ✅ PASS |
| THEME-11: opening Configurações shows theme selector (active state) + reused volume control | radiogroup + shared mute/volume | `app/_hud/classic/ClassicHud.tsx:441-486` (`role="radiogroup"`, `aria-checked={theme === "classico"}` etc., `setMuted`/`setVolume` from props); `app/__tests__/theme-selector.test.tsx:49-55` — `expect(screen.getByRole("radio", { name: "Clássico" })).toHaveAttribute("aria-checked", "true")` | ✅ PASS |
| THEME-12: selecting a different theme applies immediately, no reload | `setTheme` called on click | `app/__tests__/theme-selector.test.tsx:57-66` — clicks radio "Neon", asserts `.qwen-hud-canvas` appears without any `render`/reload call | ✅ PASS |
| THEME-13: volume adjustment in Configurações is the same state as the HUD sound control (not duplicated) | Same `volume`/`muted` prop everywhere | `app/__tests__/theme-selector.test.tsx:91-104` — sets settings-panel slider to `0.8`, returns to HUD, asserts HUD slider also reads `0.8` | ✅ PASS |
| THEME-14: "Voltar" returns to home menu in the (possibly new) selected theme | Settings dialog closes, menu shows | `app/__tests__/theme-selector.test.tsx:106-116` — clicks "Neon" then "Voltar", asserts settings dialog gone, 5 menu items visible, `.qwen-hud-canvas` present (i.e., stayed in Neon) | ✅ PASS |

### P2: Persistência

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| THEME-15: selecting a theme writes `jphud-theme` cookie (`classico`/`neon`, `path=/`, 1yr) | Exact cookie string | `lib/theme/theme-cookie.ts:19-21` — `serializeThemeCookie` returns `jphud-theme=<t>; path=/; max-age=31536000; samesite=lax`; `lib/__tests__/theme-cookie.test.ts:28-38` — `expect(serializeThemeCookie("classico")).toBe("jphud-theme=classico; path=/; max-age=31536000; samesite=lax")` (exact-string match) | ✅ PASS |
| THEME-16: no cookie → applies as soon as possible after first client render | Hook applies saved theme post-mount | `lib/theme/use-theme-preference.ts:11-17` (`useEffect(..., [])`); `lib/__tests__/use-theme-preference.test.tsx:32-35` — defaults to `classico` with no cookie | ✅ PASS |
| THEME-17: first visit / no cookie / invalid cookie → defaults to Clássico | `theme === "classico"` | `lib/__tests__/use-theme-preference.test.tsx:37-41` (valid cookie applies) — see THEME-18 for the invalid case | ✅ PASS |
| THEME-18: invalid cookie value is treated as absent, no thrown error | `parseThemeCookie` returns `null`; hook falls back silently | `lib/theme/theme-cookie.ts:14` (`VALID_THEMES.has(value) ? value : null`); `lib/__tests__/theme-cookie.test.ts:18-20`; `lib/__tests__/use-theme-preference.test.tsx:43-47` (`expect(() => render(...)).not.toThrow()`); end-to-end: `app/__tests__/theme-selector.test.tsx:154-163` (corrupted cookie mounts in Clássico, `console.error` never called) | ✅ PASS |

**Status**: ✅ 17/18 criteria matched spec outcome precisely; 1 (THEME-09, mid-run preservation) is a ⚠️ spec-precision gap — architecturally correct but not directly test-asserted, consistent with the spec's own edge case stating this path is unreachable in this version.

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 | `lib/theme/theme-cookie.ts:14` | Flipped validity check: `VALID_THEMES.has(value)` → `!VALID_THEMES.has(value)` | ✅ Killed (4/7 tests in `theme-cookie.test.ts` failed) |
| 2 | `app/page.tsx:2072` | Flipped dispatch condition: `theme === "neon"` → `theme === "classico"` | ✅ Killed (7/8 tests in `theme-selector.test.tsx` failed) |
| 3 | `lib/theme/use-theme-preference.ts:16` | Flipped mount-hydration condition: `if (saved)` → `if (!saved)` (with a cast to keep it compiling) | ✅ Killed (3/4 tests in `use-theme-preference.test.tsx` failed) |

All three mutations were applied in the isolated detached-HEAD worktree (never the primary checkout), confirmed killed, then reverted with `git checkout -- <file>`; `git status`/`git diff --stat` confirmed a clean tree after each revert and at the end of the sensor run.

**Sensor depth**: lightweight (default tier — 3 targeted behavior-level mutations)
**Result**: 3/3 killed — PASS ✅

---

## Interactive UAT Results

Not performed — this is a background/automated Verifier pass, not a live UAT session with the user. `tasks.md` already documents manual browser verification for T8 (theme switch live, Configurações reachable) done by the implementer during Execute; this Verifier pass did not re-run interactive UAT (no browser session available/requested in this task).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — diff is scoped to theme extraction/wiring; no unrelated refactors |
| Surgical changes | ✅ — `app/page.tsx` diff (621 lines changed) is presentational extraction, motor block (`useEffect` loop) untouched per design decision (Option 1) |
| No scope creep | ✅ — all 17 changed files are within the feature's declared surface (cookie/hook/HudProps/ClassicHud/NeonHud/neon.css/globals.css/page.tsx/tests/README/specs) |
| Matches patterns | ✅ — `settingsOpen`/`openSettingsPanel`/`closeSettingsPanel` mirror the existing `supportOpen`/`openSupportPanel` pattern exactly (`app/page.tsx:562-582`); cookie helpers follow the `lib/cheat-codes.ts` pure-module precedent |
| Spec-anchored outcome check (asserted values match spec) | ✅ — see table above; exact cookie string, exact class presence/absence, exact aria-checked values asserted, not just "assertion exists" |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ — `theme-cookie.ts` has 1:1 branch coverage (valid×2, absent, corrupted, multi-cookie); `use-theme-preference.ts` covers default/saved/invalid/write; integration tests cover happy path (switch), edge (corrupted cookie, remount persistence), and parity (Neon reachability) |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — every new `it()` block in the 4 touched/new test files carries an explicit `(THEME-NN)` tag in its title |
| Documented guidelines followed | ✅ — `AGENTS.md` → `testing-a11y` skill: tests consistently use `getByRole`/`getByLabelText`/`getByText`/`within` over implementation-detail selectors (one exception: `document.querySelector(".qwen-hud-canvas")` is used because the canvas has no accessible role/name to query by — reasonable given it's an HTML5 canvas) |

---

## Edge Cases

- [x] Theme switch mid-active-run preserves state — N/A per spec's own edge case (Configurações unreachable during an active run in this version; not a gap)
- [x] Browser blocks cookies (private mode) — `document.cookie` write failure is silent by native browser behavior; hook doesn't depend on write success (`lib/theme/use-theme-preference.ts:19-22`), no explicit test but consistent with the "browser handles this" strategy documented in design.md
- [x] Neon + cheat-code character-selection panel uses CRT style — `app/_hud/neon/NeonHud.tsx:405` (`role="radiogroup" aria-label="Escolha de personagem"`) sits inside the same `frameScreen`/`frame-panel` treatment as other menu panels (`menuPanel === "skins"` is part of `menuScreen && menuPanel !== "home"`)

---

## Gate Check

- **Gate command**: `npm run lint && npm run build && npm test -- --run`
- **Result**:
  - `npm run lint` → 0 errors, 8 pre-existing warnings (unrelated files: `lib/debug.ts`, `public/qwen-footer-lib.js`, `public/qwen-hud-lib.js`)
  - `npm run build` → succeeded (`✓ Compiled successfully`, all 7 routes generated including `/`, `/qwen/hud-redesign`, `/clude/hud-redesign`)
  - `npm test -- --run` → 269/269 passed on first full run; a later re-run (after sensor mutations were reverted) showed 268/269 with 1 failure in `character-power.test.tsx` ("draws the active character's shirt... CHAR-19"), which is the documented pre-existing flake — re-ran that file in isolation and got 17/17 passing, confirming it is the known parallel-execution flake, not a regression from this feature
- **Test count before feature** (at `31195af`, pre-feature): 246 tests, 17 files
- **Test count after feature** (at `9c0f33f`): 269 tests, 20 files
- **Delta**: +23 tests, +3 files (`lib/__tests__/theme-cookie.test.ts`, `lib/__tests__/use-theme-preference.test.tsx`, `app/__tests__/theme-selector.test.tsx`), plus extensions to `hud-layout.test.tsx`
- **Skipped tests**: none
- **Failures**: none that aren't the documented pre-existing flake (`character-power.test.tsx` CHAR-19)

---

## Fix Plans

None — no gaps required a fix task. The one ⚠️ spec-precision item (THEME-09 mid-run preservation) is architecturally sound and the spec itself documents why it's untestable in this version (Configurações unreachable during an active run); not escalated to a fix task.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| THEME-01 | In Tasks | ✅ Verified |
| THEME-02 | In Tasks | ✅ Verified |
| THEME-03 | In Tasks | ✅ Verified |
| THEME-04 | In Tasks | ✅ Verified |
| THEME-05 | In Tasks | ✅ Verified |
| THEME-06 | In Tasks | ✅ Verified |
| THEME-07 | In Tasks | ✅ Verified |
| THEME-08 | In Tasks | ✅ Verified |
| THEME-09 | In Tasks | ⚠️ Verified with spec-precision gap (mid-run switch not directly tested; unreachable path per spec) |
| THEME-10 | In Tasks | ✅ Verified |
| THEME-11 | In Tasks | ✅ Verified |
| THEME-12 | In Tasks | ✅ Verified |
| THEME-13 | In Tasks | ✅ Verified |
| THEME-14 | In Tasks | ✅ Verified |
| THEME-15 | In Tasks | ✅ Verified |
| THEME-16 | In Tasks | ✅ Verified |
| THEME-17 | In Tasks | ✅ Verified |
| THEME-18 | In Tasks | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 17/18 ACs matched spec outcome precisely; 1 spec-precision gap (THEME-09, non-blocking, documented as unreachable path by the spec itself)
**Sensor**: 3/3 mutations killed
**Gate**: lint 0 errors, build passed, tests 269/269 (one later run showed the pre-existing documented flake in `character-power.test.tsx`, confirmed non-regression by isolated re-run at 17/17)

**What works**: The engine (`app/page.tsx`) is now dispatch-only in its JSX return, with a single `HudProps` contract feeding two fully-functional presentation themes (Classic DOM/CSS, Neon canvas+CRT). Theme selection lives in a new "Configurações" menu item (5th→3rd position), shares the existing volume/mute state without duplication, and persists via a `jphud-theme` cookie with correct fallback-to-Classico behavior on absent/corrupted values. Test suite grew by 23 tests (17→20 files) all explicitly tagged to THEME-NN requirements. No game logic was duplicated or moved out of `app/page.tsx`, consistent with the documented Option 1 design decision (AD-009 recorded in STATE.md).

**Issues found**: None blocking. One documented spec-precision gap on THEME-09 (mid-run theme switch preserving state) — not testable in this version because the spec's own Out-of-Scope/edge-case section confirms Configurações is unreachable during an active run.

**Next steps**: None required. Optional future consideration (already flagged as Out of Scope by the spec, not a gap): removing `/clude/hud-redesign` and `/qwen/hud-redesign` study routes now that the Neon theme is live in `/`.
