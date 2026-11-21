# TraceGuard AI — 7-Hour Delivery Plan

**Date:** Saturday 21 Nov 2026 (all times ICT). **Build starts:** 10:00. **Code freeze:** 17:00. **Team:** FE1, FE2, BE1, BE2.

## Objective and Done
At least one repeatable end-to-end flow where a scenario is selected, synthetic events are analyzed by the Go backend, an evidence-backed service graph is rendered in React, and the viewer can inspect a policy finding. Out-of-order and missing-event scenarios must not create fabricated evidence. AI explanation is an enhancement with a safe fallback.

## Working sequence — ALL FOUR START IN PARALLEL

| ICT | FE1 — Framework / Graph | FE2 — Investigation UI | BE1 — Go framework / Lineage | BE2 — Detection / AI | Gate |
|---|---|---|---|---|---|
| 10:00–10:15 | Confirm component props | Confirm panel props, scenario mock | Confirm OpenAPI and domain interfaces | Confirm detection evidence rules | **Contract freeze** |
| 10:15–10:40 | Scaffold Vite/React app, merge minimal shell | Build feature panels against hardcoded fixture shape | Scaffold Go/Echo, OpenAPI spec, codegen, main, merge bootable API | Write table-driven detection test cases and pure detection service package | **Framework PRs merged** |
| 10:40–11:35 | Build React Flow nodes/edges | Build scenario selector, findings/evidence panel, typed API client mock mode | Event normalization, correlation, graph types and service | Finish unauthorized destination rule, evidence classification, tests | Core functions demonstrated locally |
| 11:35–12:30 | Wire graph to analysis response | Wire panels to real API, error/loading states | Connect analyze handler to graph + detection port | Wire detection into handler with BE1; make integration tests | **P0 end-to-end by 12:30** |
| 12:30–13:45 | Style observed/inferred edges + selection | Explanation UI + deterministic fallback | Shuffle order and missing-evidence handling, tests | AI explanation backed by evidence IDs; timeout/fallback | **P1 scenarios work** |
| 13:45–15:00 | UI polish ONLY for demo clarity | Build/type check, accessibility and failure paths | `go test`, `go vet`, regression fixes | Policy consistency, error cases, integration tests | **All scenario acceptance tests** |
| 15:00–16:00 | Freeze UI feature scope, rehearse | Run demo from clean browser / errors | Local runbook, API reliability | Fallback and explanation audit | **Stable demo / no new features** |
| 16:00–16:45 | Final visual smoke test | Readme/demo capture | Clean install, tests | Explain evidence, final verification | **Ready to submit** |
| 16:45–17:00 | Assist submission | Assist submission | Ensure latest clean main | Ensure evidence | **Submit before 17:00** |

## Contingency gates
- **10:40:** If FE or BE bootstrap is blocked, switch immediately to public minimal scaffolding; never wait for a private dependency.
- **12:30:** If P0 integration fails, stop AI work; keep static yet real graph and deterministic finding.
- **13:45:** If missing events create misleading conclusions, demote missing-case output to `INCONCLUSIVE` until fixed.
- **15:00:** No new features. Fallback to deterministic explanation if model call flaky.
- **16:45:** Only submission-critical changes.

## Integration discipline
- FE1 and BE1 are framework owners **not** feature gatekeepers: they must merge minimal bootable scaffolds by 10:40.
- FE2 and BE2 start immediately on typed mock components and pure domain logic/tests; they do not wait for UI/server bootstrapping.
- Keep a single owner for shared contracts, and write a decision record if a schema changes.
- Merge at least once before lunch; keep PRs small and CI-light.

## Explicitly OUT of scope
Formal methods, production ingestion, Kafka, persistence, auth/RBAC, real customer data, full causality reconstruction with missing logs, production-grade deployment.
