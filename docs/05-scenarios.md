# Synthetic Demo Scenarios & Expected Results

| Scenario | Evidence sketch | Expected result | Primary test |
|---|---|---|---|
| S01 Allowed | customer-api -> sales-api, approved purpose and destination, completed transfer | `NO_VIOLATION_OBSERVED` | No false positives |
| S02 External leak | sales-api -> external-crm, direct `DATA_SENT` with `COMPLETED`, denied destination | `VERIFIED_VIOLATION` | Strong evidence IDs |
| S03 Shuffled | Same exact event IDs and timestamps as S02, shuffled arrival | Same result as S02 | Permutation invariance |
| S04 Missing intermediate | external receiving clue or partial transfer details; attribution requires an unobserved intermediate link | `POTENTIAL_VIOLATION` or `INCONCLUSIVE` per evidence specificity | No invented confirmed edge |
| S05 Partial evidence, confirmed violation | `evt-e-001` records receipt by `sales-api` from `customer-api`. `evt-e-002` records a completed send of synthetic PII from `sales-api` to `external-crm`, a destination outside the policy allowlist. | `VERIFIED_VIOLATION` overall. The outbound edge is `OBSERVED`. The upstream edge is `INFERRED` and its finding is `INCONCLUSIVE`. | The outbound finding cites `evt-e-002`. The upstream finding cites `evt-e-001` and lists the missing completed send. |

Load S05 with `scenario_id` set to `partial_evidence_confirmed`. [Fixture](../backend/internal/adapters/fixtures/data/partial_evidence_confirmed.json)

Additional cases if time: attempted/failed transfer, duplicate log lines, mixed purposes, irrelevant services.

## Golden acceptance cases
1. Graph edges are reproducible when event list order changes.
2. Every `OBSERVED` edge has at least one supporting event ID in input.
3. S04 keeps findings that rely on an unobserved link below `VERIFIED_VIOLATION`. S05 returns `VERIFIED_VIOLATION` overall because `evt-e-002` supports the `OBSERVED` outbound edge. The upstream edge stays `INFERRED` and its finding stays `INCONCLUSIVE` because `evt-e-001` records receipt and the matching completed send is missing.
4. Selected finding highlights the correct graph nodes/edges in React Flow.
5. AI answer references actual IDs; offline fallback works.

## Demo narrative (90–150 sec)
1. S01 is normal.
2. S02 reveals a policy-breaching destination; click evidence ID.
3. Toggle S03: out-of-order logs preserve finding.
4. Toggle S04: system shows uncertainty, not a false assurance or fabricated event.
5. Switch to S05 and explain the verified outbound finding. Point to `evt-e-002` on the `OBSERVED` edge and `evt-e-001` on the `INFERRED` upstream edge. Show the next investigation actions and use the fallback if the model is unavailable.
