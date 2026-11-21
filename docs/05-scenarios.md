# Synthetic Demo Scenarios & Expected Results

| Scenario | Evidence sketch | Expected result | Primary test |
|---|---|---|---|
| S01 Allowed | customer-api -> sales-api, approved purpose and destination, completed transfer | `NO_VIOLATION_OBSERVED` | No false positives |
| S02 External leak | sales-api -> external-crm, direct `DATA_SENT` with `COMPLETED`, denied destination | `VERIFIED_VIOLATION` | Strong evidence IDs |
| S03 Shuffled | Same exact event IDs and timestamps as S02, shuffled arrival | Same result as S02 | Permutation invariance |
| S04 Missing intermediate | external receiving clue or partial transfer details; attribution requires an unobserved intermediate link | `POTENTIAL_VIOLATION` or `INCONCLUSIVE` per evidence specificity | No invented confirmed edge |

Additional cases if time: attempted/failed transfer, duplicate log lines, mixed purposes, irrelevant services.

## Golden acceptance cases
1. Graph edges are reproducible when event list order changes.
2. Every `OBSERVED` edge has at least one supporting event ID in input.
3. S04 never returns `VERIFIED_VIOLATION` solely because a link seems plausible.
4. Selected finding highlights the correct graph nodes/edges in React Flow.
5. AI answer references actual IDs; offline fallback works.

## Demo narrative (90–150 sec)
1. S01 is normal.
2. S02 reveals a policy-breaching destination; click evidence ID.
3. Toggle S03: out-of-order logs preserve finding.
4. Toggle S04: system shows uncertainty, not a false assurance or fabricated event.
5. Request explanation and next investigation actions; show reliable fallback if model unavailable.
