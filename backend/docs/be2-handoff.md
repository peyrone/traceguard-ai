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
