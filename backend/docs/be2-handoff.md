# BE2 detection handoff

The Go module is `github.com/peyrone/traceguard-ai/backend`. Shared types live
under `internal/domain/traceguard/core/entities`. Use `Event`, `Policy`, `Graph`,
`Node`, `Edge`, `Finding`, `Status` and `EvidenceStatus`. The consumer interface
lives in the adjacent `ports` package.

```go
Detect(ctx context.Context, events []entities.Event, graph entities.Graph, policy entities.Policy) ([]entities.Finding, error)
```

Input events are deduplicated and sorted by event time. To evaluate a transfer,
use the original event's classification, purpose, outcome and endpoints.
An inferred graph edge is a clue. Reference supporting input event IDs and
describe missing evidence where applicable.

Sample input is `evt-003`, a PII `DATA_SENT` event with outcome `COMPLETED`
from `sales-api` to `external-crm` for `MARKETING`. The graph has one
`OBSERVED` edge citing `evt-003`. The policy allows `sales-api` and
`customer-api` as destinations and `CUSTOMER_SERVICE` as a purpose.

Expected output contains a `DENY_EXTERNAL_PII` finding with status
`VERIFIED_VIOLATION`, evidence `["evt-003"]`, and empty missing evidence.

The lineage adapter retains the earliest receipt for retries of an identical
event and drops IDs with conflicting payloads. A completed send with both
endpoints is observed. An unmatched completed receipt can support an inferred
edge using its explicit endpoints or a unique upstream destination with the
same trace and data reference. Attempted and failed sends are inferred clues
when both endpoints are present. Only completed sends support observed edges.

The API uses `INCONCLUSIVE` until a detector supplies a status. To distinguish
an evaluated allowed transfer from a result with insufficient evidence,
return a status-bearing finding with `NoViolationObserved` when appropriate.
