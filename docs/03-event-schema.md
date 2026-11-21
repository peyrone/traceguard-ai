# Audit Event and Evidence Semantics

Planning schema; encode formally in the OpenAPI spec during the competition.

```json
{
  "event_id":"evt-003",
  "trace_id":"trace-001",
  "transfer_id":"xfer-003",
  "occurred_at":"2026-11-21T10:10:00Z",
  "observed_at":"2026-11-21T10:10:04Z",
  "service":"sales-api",
  "action":"DATA_SENT",
  "outcome":"COMPLETED",
  "source_service":"sales-api",
  "destination_service":"external-crm",
  "data_ref":"synthetic-subject-001",
  "classification":"PII",
  "purpose":"MARKETING"
}
```

## Required semantics
- Event identity: `event_id` unique; duplicate IDs deduplicated deterministically.
- Order: `occurred_at` = event time; `observed_at` = receipt time. Ingestion order must not determine lineage.
- Correlation: `trace_id`, `transfer_id` and `data_ref` are hints, not proof by themselves.
- Outcome: `COMPLETED`, `ATTEMPTED`, `FAILED` must be distinguished.
- `DATA_SENT` is evidence of a sent transfer only if outcome is `COMPLETED` under the demo's documented instrumentation assumption.
- Any unobserved inferred relationship is `INFERRED` and cannot by itself justify a verified finding.
- No literal customer names, phone numbers, emails, account numbers, passwords, tokens or sensitive data payloads.

## Classification
- `VERIFIED_VIOLATION`: direct event evidence establishes the forbidden action under the policy.
- `POTENTIAL_VIOLATION`: indicators suggest a prohibited lineage/transfer but one or more necessary links are unverified.
- `INCONCLUSIVE`: insufficient evidence even to link the suspected action meaningfully.
- `NO_VIOLATION_OBSERVED`: nothing violating policy in available events; not proof of compliance.

## Event correctness checks
1. Duplicates do not duplicate graph edges or findings.
2. Arrival order permutation yields equivalent result.
3. An attempted or failed transfer cannot count as completed exfiltration.
4. Gaps produce missing-evidence markers, not synthetic confirmed events.
5. Findings reference real event IDs present in analyzed dataset.
