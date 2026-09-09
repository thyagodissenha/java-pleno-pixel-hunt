# Motor de Jogo Modular — Fix2 Validation

**Date**: 2026-09-09
**Spec**: `_docs/specs/features/motor-de-jogo-modular-fix2/spec.md`
**Diff range**: `15f8104..HEAD` (11 commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1 (ENGINE-27) | ✅ Done | `emptyFrameEvents()` added `lib/pixel-hunt-engine/types.ts:223`; 0 local `emptyEvents` definitions remain (grep confirmed) |
| T2 (ENGINE-24/25) | ✅ Done | `applyPlayerDamage` `lib/pixel-hunt-engine/physics.ts:504`; both call sites migrated; regression test added |
| T3 (ENGINE-26) | ✅ Done | `weapon-progression.ts` created; both functions have exactly 1 definition (grep confirmed); no import cycle introduced |
| T4-T6 (ENGINE-28, merged commit) | ✅ Done | `PhaseState` union in `types.ts:160-188`; `normal-run`/`secret-mainframe` `readState()` migrated to discriminant. Merge documented as `SPEC_DEVIATION` in tasks.md (compiler-forced task-boundary merge, no AC change) — verified as a legitimate, well-justified deviation, not a behavior change |
| T7 (ENGINE-28) | ✅ Done | `renderer.ts:readSecretPhaseState` (at the time) migrated to discriminant, local type definition removed |
| T8 (ENGINE-28) | ✅ Done | `orchestrator.ts:readPhaseLocalGameState` reads `world.phaseState?.localGameState` directly, no cast |
| T9 (ENGINE-29) | ✅ Done | `renderer/phase-state.ts` created, exports `readSecretPhaseState` |
| T10 (ENGINE-29) | ✅ Done | `renderer/actors.ts` exports `drawMainframeBoss`, `drawActor`, `drawObstacle`, `drawPowerUp`, `drawPlayer` |
| T11 (ENGINE-29) | ✅ Done | `renderer/overlays.ts` exports `drawDim`, `drawOverlay`, `drawVictoryOverlay` |
| T12 (ENGINE-29) | ✅ Done | `renderer/world.ts` exports `drawGrid`, `drawDatacenterFloor`, `drawFinalChoiceScene`, `drawSecretRunOverlay` (named extraction of the former inline block) |
| T13 (ENGINE-29) | ✅ Done | `lib/pixel-hunt-engine/renderer.ts` no longer exists; `renderer/index.ts` is the facade, `drawFrame` signature unchanged, both Phase consumers import from the same `@/lib/pixel-hunt-engine/renderer` path unchanged |

All 12 original `draw*` functions accounted for across the 4 submodules, no function present in more than one file (verified via `grep -n "^export function\|^function"` across `renderer/*.ts`).

---

## Spec-Anchored Acceptance Criteria

### ENGINE-24/25 — P1: Consolidar regra de dano ao jogador

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: dano de toque ou tiro secreto com `invincible <= 0` aplica dano via função única, setando `invincible=0.92`, `damageFlash=16`, `shake=14`, `events.playerHit=true`, som `"hurt"`, burst `"#ff5353"` | Single shared function, exact side effects listed | `lib/pixel-hunt-engine/physics.ts:504-514` — `applyPlayerDamage` body sets exactly these 6 effects; called from `physics.ts:528` (`resolveEnemyPlayerCollisions`) and `phases/secret-mainframe/index.ts:216` (`stepSecretBossShots`) | ✅ PASS |
| AC2: dano de toque usa `ENEMY_TOUCH_DAMAGE[enemy.kind]`/burst 16; dano de tiro secreto usa `10`/burst 12, preservados exatamente | Exact original values preserved as parameters | `lib/pixel-hunt-engine/physics.ts:528` — `applyPlayerDamage(world, audio, events, ENEMY_TOUCH_DAMAGE[enemy.kind], 16)`; `phases/secret-mainframe/index.ts:216` — `applyPlayerDamage(world, ctx.audio, events, 10, 12)` | ✅ PASS |
| AC3: dano por tiro do chefe secreto agora seta `events.playerHit = true` | `events.playerHit === true` after secret boss shot damage | `phases/secret-mainframe/__tests__/index.test.ts:176` — `expect(events.playerHit).toBe(true)` (new test, "ENGINE-25 regression") | ✅ PASS |
| AC4: suíte existente (421) continua passando + 1 novo teste dedicado | 421 existing + 1 new dedicated test | Gate check §below: 423 total (421 baseline + 2 new — see note) | ✅ PASS (spec asked for +1, T2 delivered +2: a positive-path test and an "already invincible, no double damage" test — both scoped to ENGINE-25, not scope creep) |

**Independent Test** (spec.md): `grep -c "run.damageFlash = 16" physics.ts secret-mainframe/index.ts` → confirmed sums to 1 (see Gate Check independent-test grep run below). ✅

**Status**: ✅ All ACs covered

### ENGINE-26 — P2: Dedupe `shotLanesForWeaponLevel`/`weaponLevelForWave`

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: fonte única, sem redefinição local | 1 definition of each function, engine-wide | `lib/pixel-hunt-engine/weapon-progression.ts:11,18` — sole definitions; `physics.ts` and `wave-progression.ts` both import, no local `function` (grep confirmed 0 local defs outside `weapon-progression.ts`) | ✅ PASS |
| AC2: nenhum ciclo de import introduzido | No new import cycle | `weapon-progression.ts` has zero imports (verified by reading the file) — cannot participate in a cycle | ✅ PASS |
| AC3: suíte existente com mesmos valores exatos | Same exact values, all tests green | `phases/normal-run/__tests__/wave-progression.test.ts` (19 cases) passes unchanged; discrimination sensor mutation #3 below confirms this suite would catch a value regression | ✅ PASS |

**Status**: ✅ All ACs covered

### ENGINE-27 — P2: Dedupe `emptyEvents()`

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: fonte única compartilhada, sem redefinição local | 1 shared factory, 0 local copies | `lib/pixel-hunt-engine/types.ts:223` — `emptyFrameEvents()`; `grep -c "^function emptyEvents"` on the 3 former locations sums to 0 | ✅ PASS |
| AC2: estrutura torna futuro campo "1 local só" por construção | Structural guarantee (not directly testable this round, per spec) | Structural: single factory, 3 call sites import it — spec explicitly says "not directly testable" | ⚠️ Spec-precision gap (spec itself flags this AC as non-testable this round — correctly treated as structural evidence, not a test gap) |
| AC3: suíte existente continua passando | All existing tests green | Full suite run — see Gate Check | ✅ PASS |

**Status**: ⚠️ AC2 is a spec-acknowledged non-testable structural criterion, not a Verifier-found gap — correctly flagged per spec's own wording.

### ENGINE-28 — P2: Tipar `EngineWorld.phaseState`

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `phaseState` tipado como união discriminada dos 2 estados existentes | `PhaseState = NormalRunPhaseState \| SecretMainframePhaseState`, replaces `unknown` | `types.ts:160-175` (union definition), `types.ts:188` — `phaseState: PhaseState \| null` | ✅ PASS |
| AC2: cast manual + checagem de campo em runtime substituídos por discriminante explícito | `"field" in existing` duck-typing removed at all read sites | `phases/normal-run/index.ts:24` — `world.phaseState?.phase === "normal-run"`; `phases/secret-mainframe/index.ts:104` — `world.phaseState?.phase === "secret-mainframe"`; `renderer/phase-state.ts:11` — same pattern; `orchestrator.ts` — direct field access, no cast (4/4 sites; design.md's risk note about the 4th/2nd extra site is fully addressed) | ✅ PASS |
| AC3: `npm run build` (tsc) passa sem novo erro de tipo | Clean `tsc` across all consumers | `npm run build` — confirmed clean (see Gate Check) | ✅ PASS |
| AC4: suíte existente continua passando | All existing tests green | Full suite run — see Gate Check | ✅ PASS |

**Independent Test** (spec.md): `grep -n "phaseState: unknown" types.ts` → no match (confirmed). ✅

**Status**: ✅ All ACs covered

### ENGINE-29 — P3: Dividir `renderer.ts` em submódulos coesos

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: mantém exatamente uma função pública `drawFrame`, mesma assinatura, importável sem mudança de path | Same signature, same import path for both Phase consumers | `renderer/index.ts:28` — `export function drawFrame(ctx: CanvasRenderingContext2D, world: EngineWorld, view: ViewState): void` (identical to pre-split signature); both `phases/normal-run/index.ts:14` and `phases/secret-mainframe/index.ts:14` still import from `@/lib/pixel-hunt-engine/renderer` unchanged | ✅ PASS |
| AC2: cada submódulo agrupa por área coesa, nenhuma função em mais de 1 submódulo | Coherent grouping, no duplicate placement | `renderer/actors.ts` (5 entity-draw fns), `renderer/overlays.ts` (3 overlay fns), `renderer/world.ts` (3 scene fns + named `drawSecretRunOverlay`), `renderer/phase-state.ts` (1 reader) — `grep -n "^export function\|^function"` across all 4 files shows exactly 12 `draw*`/reader functions, each appearing once | ✅ PASS |
| AC3: duplicação interna cai de 35.7% para <15% (SonarQube local) | Measurable drop below 15% | SonarQube MCP `get_duplications` on `renderer/index.ts` and `renderer/world.ts` (the two files most likely to retain the old inline-vs-`drawDatacenterFloor` duplication): both return `{"duplications":[],"files":[]}`. Project-wide `search_duplicated_files` returns `overallDuplicationDensity: "0.0"`, 0 duplicated files. Far exceeds the <15% target (0.0% vs. 35.7% baseline) | ✅ PASS (see caveat below) |
| AC4: suíte existente continua passando, mesmo output visual | All tests green, no drawing-logic change | Full suite run — see Gate Check. No `draw*` function body was edited beyond file relocation (spot-checked `drawGrid`, `drawPlayer`, `drawSecretRunOverlay` bodies against the pre-split `renderer.ts` diff — logic byte-identical, only moved) | ✅ PASS |

**Caveat on AC3 evidence**: the SonarQube scan backing the 0.0% figure (`.scannerwork/report-task.txt`, timestamped 08:12:35) was run ~4 minutes *before* the T13 commit (08:16:16) that produced the final `renderer/index.ts` facade. T13's diff (verified by direct inspection) is a pure mechanical re-assembly of already-extracted, already-scanned code (T9-T12) into a facade — it introduces no new duplicated lines, so the risk of the stale scan understating duplication is low, but a fresh scan against the exact final commit was not obtained during this validation (no `SONAR_TOKEN` available in this session to trigger `sonar-scanner` directly, and the SonarQube MCP tool has no "trigger analysis" action, only read endpoints). Recommend a fresh scan before closing ENGINE-29 formally if a hard guarantee at HEAD is required.

**Status**: ✅ All ACs covered, with one dated-evidence caveat on AC3 (informational, not a functional gap — code inspection confirms T13 adds no new duplication)

---

## Discrimination Sensor

All 3 mutations were injected directly into the working tree (no uncommitted local changes existed beforehand), each confirmed killed, then reverted with `git checkout --` and the working tree confirmed clean (`git status --porcelain` empty for `lib/pixel-hunt-engine/`) before the next mutation.

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `lib/pixel-hunt-engine/physics.ts:511` | Removed `events.playerHit = true;` from `applyPlayerDamage` | ✅ Killed — `physics.test.ts` ("damages the player on contact... reports playerHit") and the new `secret-mainframe/__tests__/index.test.ts` ENGINE-25 regression test both failed (2 failures) |
| 2 | `lib/pixel-hunt-engine/phases/secret-mainframe/index.ts:104` | Flipped discriminant `phase === "secret-mainframe"` → `phase !== "secret-mainframe"` in `readState()` | ✅ Killed — 4 tests in `secret-mainframe/__tests__/index.test.ts` failed (isComplete checks, ENGINE-25 regression test) |
| 3 | `lib/pixel-hunt-engine/weapon-progression.ts:19` | Off-by-one: `if (wave >= 4) return 3;` → `if (wave >= 5) return 3;` in `weaponLevelForWave` | ✅ Killed — `wave-progression.test.ts` case `weaponLevelForWave(wave=4) === 3` failed |

**Sensor depth**: lightweight (default tier — 3 targeted mutations across the 2 highest-risk new-behavior areas: the P1 bug fix and the P2 dedupe modules)
**Result**: 3/3 killed — PASS ✅

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ Every task's diff matches its "Where"/"What" in tasks.md — no unrelated edits found |
| Surgical changes | ✅ 11 commits, each scoped to 1 task (or the compiler-forced T4-T6 merge, explicitly logged as `SPEC_DEVIATION`) |
| No scope creep | ✅ The explicitly out-of-scope `engine → app` dependency (`GameState`/`MenuPanel` from `app/_hud/hud-props`) is still imported as-is in `renderer/index.ts:12` — untouched, as spec required |
| Matches patterns | ✅ `weapon-progression.ts` follows the `geometry.ts` module-kernel pattern (zero engine imports); `applyPlayerDamage` follows the T18/T19 fix1 pattern of internal extraction with an eventual export |
| Spec-anchored outcome check (asserted values match spec) | ✅ See Spec-Anchored Acceptance Criteria above — every precise numeric/boolean outcome in spec.md is matched by an exact assertion or grep |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ Matches tasks.md's own Test Coverage Matrix — domain layer (T2) got a dedicated new test; pure-dedupe layers (T1, T3) correctly rely on the existing regression suite per the matrix's named exception; renderer layer (T7, T9-T13) correctly has 0 new tests per the matrix's documented floor (0 pre-existing renderer tests) |
| Every test maps to a spec requirement — no unclaimed tests | ✅ Both new tests in `secret-mainframe/__tests__/index.test.ts` map directly to ENGINE-25 (the positive case is the named AC3 regression test; the "already invincible" case verifies AC1's guard-moved-inside-the-function decision from design.md, not scope creep) |
| Documented project quality/testing guidelines followed | ✅ `AGENTS.md` §10 (Vitest + Testing Library + Playwright); tasks.md's own Test Coverage Matrix (project-local, derived from codebase sampling) — both followed |

One minor, non-blocking observation (not a "No" on any principle above): `physics.ts:527` (`resolveEnemyPlayerCollisions`) still has an outer `if (player.invincible <= 0)` guard wrapping the call to `applyPlayerDamage`, which now also guards internally (`physics.ts:505`). This is a deliberate, documented decision in design.md ("Guard... moved inside `applyPlayerDamage`... Sim, movido") — the outer guard was already there pre-fix2 gating the `enemies.splice` call too, so removing it would have been an unrelated behavior change outside this round's scope. Redundant-but-safe, not a defect.

---

## Edge Cases (spec.md)

- [x] Splice order preserved: `enemies.splice`/`secretBossShots.splice` still happen in the caller, not inside `applyPlayerDamage` (`physics.ts:529`, `secret-mainframe/index.ts:215-216`) — confirmed by reading both call sites
- [x] `world.phaseState` uninitialized fallback: both `readState()` functions retain their defensive fallback branch (`normal-run/index.ts:25-28`, `secret-mainframe/index.ts:105-119`), now typed instead of duck-typed, same robustness
- [x] Renderer split dependency resolution: `drawSecretRunOverlay` (formerly inline in `drawFrame`) is now an explicit export from `renderer/world.ts`, imported by `renderer/index.ts` — no function was duplicated across submodules (confirmed by the single-occurrence grep above)

---

## Gate Check

- **Gate command**: `npm run build && npm run lint && npm test` (per tasks.md's "Build" gate level, "fim de cada fase e antes do commit final")
- **Result**: build ✅ clean (tsc, no errors), lint ✅ 0 errors / 10 pre-existing warnings (all in files untouched by this diff: `app/estudo-tela-inicial`, `lib/debug.ts`, `public/qwen-*.js`, `coverage/`), test ✅ 423/423 passed on 4 of 5 fresh runs (see note below)
- **Test count before feature**: 421
- **Test count after feature**: 423
- **Delta**: +2 new tests (both in `phases/secret-mainframe/__tests__/index.test.ts`, both scoped to ENGINE-25 — spec asked for "at least 1", 2 delivered, not scope creep, see ENGINE-24/25 AC4 above)
- **Skipped tests**: none
- **Failures**: **One transient, pre-existing flake observed in 1 of 5 fresh `npm test` runs** — `phases/normal-run/__tests__/index.test.ts` > "resolves 'call' on a direct click, without waiting for passive collision" (`TypeError: Cannot read properties of undefined (reading 'x')` at line 212, `call.x` where `call` is `undefined`). Root cause: `world.powerUps.find((p) => p.kind === "call")` can return `undefined` because the final-choice power-up spawn (`reachFinalChoice` helper / `spawnFinalChoices`) is randomized and does not guarantee a "call" kind spawns every run. **This file and its randomized spawn logic (`phases/normal-run/final-choice.ts`) were not touched by this diff** — confirmed via `git diff --stat 15f8104..HEAD` (not in the changed-files list). Re-ran 4 additional times, 423/423 green each time. Classified as **pre-existing flakiness, not a regression introduced by fix2** — flagged as an informational finding, not a gate failure.
- **Independent-test greps** (spec.md, all confirmed): `grep -c "run.damageFlash = 16"` sums to 1; `weapon-progression.ts` has exactly 1 definition of each function; `emptyEvents` local definitions sum to 0; `phaseState: unknown` has no match.

### E2E (`npm run test:e2e`)

**Attempted fresh in this session** (not assumed). Result: still blocked — `Another next dev server is already running... PID: 60999`. This matches the environment constraint already logged in tasks.md's T13 execution note (a different chat session holds a Next.js dev-server lock on this same working directory). **Classified as environment-blocked, not a code defect** — `npm run build` (which runs its own isolated production build, no dev-server conflict) passed clean, and the full unit suite (423 tests) already exercises `stepWorld`/both Phases/the renderer's non-drawing logic. No E2E regression evidence either way; this remains an open verification gap that only running outside this environment can close.

### SonarQube (local)

Duplication confirmed via SonarQube MCP (`get_duplications`, `search_duplicated_files`) — project-wide 0.0% duplication, 0 duplicated files, `renderer/index.ts` and `renderer/world.ts` individually confirmed at 0 duplications. See the AC3 caveat under ENGINE-29 above regarding the scan's timestamp relative to the final T13 commit.

---

## Fix Plans (if issues found)

None required — no surviving mutants, no failed ACs, no code-quality "No" answers. The two items below are informational only, not blocking:

### Info 1: Pre-existing test flake in `phases/normal-run/__tests__/index.test.ts`

- **Root cause**: `spawnFinalChoices`/`reachFinalChoice` test helper spawns final-choice power-ups with randomized kind selection; the "call" kind is not guaranteed present in every run, so `world.powerUps.find((p) => p.kind === "call")!` occasionally returns `undefined`, and the non-null assertion masks it until the next line dereferences `.x`.
- **Not part of this diff** — file untouched by fix2 — out of scope for this validation's fix plan, but worth a follow-up ticket since it can intermittently fail CI.
- **Priority**: Minor (test-infra flakiness, not a product bug)

### Info 2: SonarQube AC3 evidence timestamp gap

- **Root cause**: local scan used as evidence predates the final T13 commit by ~4 minutes; a fresh scan at exact HEAD was not obtainable in this session (no `SONAR_TOKEN`, MCP tool is read-only).
- **Priority**: Minor (code-inspection cross-check makes a duplication regression very unlikely, but a fresh scan would make AC3's evidence airtight)

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| ENGINE-24 | Pending | ✅ Verified |
| ENGINE-25 | Pending | ✅ Verified |
| ENGINE-26 | Pending | ✅ Verified |
| ENGINE-27 | Pending | ✅ Verified |
| ENGINE-28 | Pending | ✅ Verified |
| ENGINE-29 | Pending | ✅ Verified (AC3 evidence caveat noted, not blocking) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 6/6 requirement IDs matched their spec-defined outcomes (1 spec-acknowledged non-testable structural AC in ENGINE-27 correctly flagged, not a gap)
**Sensor**: 3/3 mutations killed
**Gate**: build ✅, lint ✅ (0 errors), test ✅ 423/423 (1 transient pre-existing unrelated flake observed and characterized, not attributable to this diff)

**What works**: All 5 consolidation/typing/split changes are present, correctly scoped, and behaviorally verified. `events.playerHit` bug is fixed with a dedicated regression test. `renderer.ts` split preserves the public `drawFrame` API and import path exactly. `phaseState` typing closes all 4 read sites the design doc identified (not just the 2 the original spec assumed). Duplication in `renderer/` measured at 0.0%, well under the <15% target.

**Issues found**: None blocking. Two informational, non-blocking notes: (1) a pre-existing, out-of-diff-scope flaky test in `normal-run/__tests__/index.test.ts` observed during repeated gate runs; (2) the SonarQube evidence for ENGINE-29 AC3 is timestamped slightly before the final commit (code inspection makes a regression very unlikely, but a fresh scan would close the gap formally).

**Next steps**: None required to close this fix cycle. Optional follow-ups (not blocking): file a quick-task for the `normal-run` final-choice test flake; re-run SonarQube once `test:e2e`'s dev-server lock is free, bundling both into one verification pass.
