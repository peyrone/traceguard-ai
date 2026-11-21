# Architecture Decision Log

| Date | Decision | Reason | Trade-off |
|---|---|---|---|
| 2026-11-15 | Original clean-room monorepo | Cannot use private starter repository | Small amount of scaffold written during event |
| 2026-11-15 | Echo + OpenAPI-first | Familiar public API approach, clear contracts | Upfront codegen setup |
| 2026-11-15 | Ports & adapters selectively | Testable domain; minimal coupling | Avoid excess wrappers |
| 2026-11-15 | No persistence | 7h build budget | Demo state lasts one session |
| 2026-11-15 | Evidence-aware findings | Missing logs must not become fabricated facts | May show inconclusive outcomes |
| 2026-11-15 | Codex only, no full Superpowers requirement | Speed/consistency | Testing remains mandatory |

| 2026-11-21 | Release captain approved additive privacy decision contract and dedicated contract PR | Demonstrate preventive enforcement with a synthetic executor | BE1 server and FE2 dashboard integration follow contract review. Decisions stay separate from historical audit evidence. |

Append to this log when scope/contract changes; include the agreeing owners and consequence.
