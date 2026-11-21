# Synthetic Demo Scenarios & Expected Results

| Scenario | Evidence sketch | Expected result | Primary test |
|---|---|---|---|
| S01 Allowed (5 nodes) | `customer-api → sales-api` carries approved synthetic PII. Operational records also show `customer-api → consent-api` and `sales-api → case-router → case-store`. | `NO_VIOLATION_OBSERVED` | All four edges are observed. Only `evt-001` is in scope for the PII policy. |
| S02 External leak (6 nodes) | Alongside approved PII transfers to the consent and case services, `sales-api → external-crm` carries synthetic PII for marketing. | `VERIFIED_VIOLATION` | The outbound edge and the finding cite the completed send `evt-003`. |
| S03 Shuffled (6 nodes) | All six S02 audit records appear in a different input order. | Same result as S02 | The investigation summary, graph, and findings are identical despite the permutation. Transfer candidate IDs are scoped to each scenario. |
| S04 Missing intermediate (5 nodes) | `external-crm` reports receipt in `evt-004` with no sender. `evt-001` supplies the prior hop to `sales-api`. The observed `sales-api → case-router → case-store` branch shares the trace ID and carries a separate data reference. | `POTENTIAL_VIOLATION` | The inferred outbound edge cites `evt-001` and `evt-004`. The finding cites the receipt and asks for a matching completed send. |
| S05 Partial evidence, confirmed violation (5 nodes) | `consent-api → customer-api` and `sales-api → case-store` are observed. `evt-e-001` records receipt by `sales-api` from `customer-api`. `evt-e-002` records a completed PII send from `sales-api` to `external-crm`. | `VERIFIED_VIOLATION` overall. The upstream link remains `INFERRED` with an `INCONCLUSIVE` finding. | The outbound finding cites `evt-e-002`. The upstream finding cites `evt-e-001` and lists the missing completed send. |

Load S05 with `scenario_id` set to `partial_evidence_confirmed`. [Fixture](../backend/internal/adapters/fixtures/data/partial_evidence_confirmed.json)

Additional cases if time: attempted and failed transfers, duplicate log lines, and conflicting receipts.

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
