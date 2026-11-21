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

| 2026-11-21 | Release captain approved additive scenario-scoped transfer candidate contract | Preserve the selected scenario’s graph, evidence, and policy during simulation | Contract reviewed separately. Backend resolves fixture references and existing explicit requests remain supported. |

| 2026-11-21 | Release captain approved optional explanation insights and GDPR mappings | Give investigations an evidence-cited legal review without changing policy verdicts | Dedicated contract PR precedes BE1, BE2 and FE2 integration. Existing callers retain the original fields. |

Append to this log when scope/contract changes; include the agreeing owners and consequence.
