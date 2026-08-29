# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `_docs/specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — Expose observable boss health state so debug tests can assert a full-health spawn
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `gameplay` · harmful: 0
- features: estabilidade-qualidade
- evidence: _docs/specs/features/estabilidade-qualidade/validation.md:36 (gameplay)
- last seen: 2026-08-27T14:13:25Z

### L-002 — Assert required gameplay side effects directly, not only derived HUD text
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `gameplay` · harmful: 0
- features: estabilidade-qualidade
- evidence: _docs/specs/features/estabilidade-qualidade/validation.md:78 (gameplay)
- last seen: 2026-08-27T14:13:25Z

### L-003 — Capture before-and-after SonarQube code-smell counts when a requirement promises a reduction
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `quality` · harmful: 0
- features: estabilidade-qualidade
- evidence: _docs/specs/features/estabilidade-qualidade/validation.md:41 (quality)
- last seen: 2026-08-27T14:13:25Z

### L-004 — Assert required responsive CSS declarations in an automated test when viewport behavior is an acceptance criterion
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: estabilidade-qualidade
- evidence: _docs/specs/features/estabilidade-qualidade/validation.md:42 (ui)
- last seen: 2026-08-27T14:13:25Z

### L-005 — Assert every conjunct of a no-side-effect security criterion across UI state, entities, network, and storage.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `debug-security` · harmful: 0
- features: estabilidade-qualidade
- evidence: ESTAB-06 AC3 (debug-security)
- last seen: 2026-08-28T01:26:24Z

### L-006 — Exercise each retryable response from a newly created submission, not only from a pre-populated pending queue.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `score-sync` · harmful: 0
- features: estabilidade-qualidade
- evidence: ESTAB-09 AC1 (score-sync)
- last seen: 2026-08-28T01:26:24Z

### L-007 — After asserting queue retention on failure, trigger the documented recovery event and assert the same item is retried.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `score-sync` · harmful: 0
- features: estabilidade-qualidade
- evidence: ESTAB-10 AC4 (score-sync)
- last seen: 2026-08-28T01:26:24Z

### L-008 — Concurrency tests must count both in-flight requests and scheduled retry timers when the contract limits both.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `score-sync` · harmful: 0
- features: estabilidade-qualidade
- evidence: ESTAB-10 AC5 (score-sync)
- last seen: 2026-08-28T01:26:24Z

### L-009 — Test every ownership-sensitive operation against a stale token and assert both the outcome and preservation of the current owner.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ranking-idempotency` · harmful: 0
- features: estabilidade-qualidade
- evidence: ESTAB-16 AC2-AC3 (ranking-idempotency)
- last seen: 2026-08-28T16:44:53Z

### L-010 — Preserve a direct test for each dependency-absence trigger when replacing the persistence path.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `score-api` · harmful: 0
- features: estabilidade-qualidade
- evidence: P2 API AC1 (score-api)
- last seen: 2026-08-28T16:44:59Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
