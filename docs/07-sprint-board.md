# GitHub Issues — Create These Before Build Day

**Planning issues** may be created before competition. New application code is implemented during the official window. Each issue should have a clear owner, dependency, test/evidence and acceptance check.

| ID | Priority | Owner | Issue title | Dependency | Done when |
|---|---|---|---|---|---|
| TG-01 | P0 | Team | Lock API/event/graph/props contract | — | All 4 approve; no schema ambiguity |
| TG-02 | P0 | FE1 | Scaffold public React/Vite app and layout | TG-01 | `npm run build` passes; importable shell |
| TG-03 | P0 | BE1 | Scaffold public Go/Echo server, OpenAPI generator | TG-01 | server boots + healthz + codegen runs |
| TG-04 | P0 | FE2 | Scenario picker + Findings/Evidence components with mock data | TG-01 | Components render in isolation without backend |
| TG-05 | P0 | BE2 | Pure privacy policy evaluator + table tests | TG-01 | tests pass for allowed/denied/attempt |
| TG-06 | P0 | BE1 | Correlate events + construct evidence graph | TG-03 | graph has source IDs, stable order |
| TG-07 | P0 | FE1 | Render data lineage graph | TG-02 | observed/inferred distinction + selection |
| TG-08 | P0 | BE1 | `POST /analyze` composes lineage + detection | TG-05,TG-06 | real scenario yields verified finding |
| TG-09 | P0 | FE2 | Typed API client and investigation integration | TG-03,TG-04 | dashboard calls real backend |
| TG-10 | P0 | FE1 | Wire app shell graph + investigation feature | TG-07,TG-09 | single-screen end-to-end |
| TG-11 | P1 | BE1 | Out-of-order / duplicate invariants | TG-06 | deterministic shuffle tests |
| TG-12 | P1 | BE2 | Missing-evidence classification and tests | TG-05,TG-06 | potential/inconclusive, no fake evidence |
| TG-13 | P1 | BE2 | AI explanation with deterministic fallback | TG-05 | works with/without API key |
| TG-14 | P1 | FE2 | Explanation panel/error and loading states | TG-09,TG-13 | no blank screen on AI timeout |
| TG-15 | P0 | Team | End-to-end scenario smoke tests | TG-08,TG-10 | S01–S04 behavior matches docs |
| TG-16 | P0 | Team | Demo script, clean checkout and submission | TG-15 | clean start + judges can follow README |

## Release gating
- Before 10:40: TG-02/TG-03 minimal scaffold merged.
- Before 12:30: TG-08/TG-10 done; a real end-to-end run demonstrated.
- Before 15:00: P1 done or explicitly deferred.
- By 16:45: TG-16 ready and submitting.
