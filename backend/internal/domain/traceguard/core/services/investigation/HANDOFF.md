# BE2 integration handoff

All imports below are relative to `github.com/peyrone/traceguard-ai/backend`.

| Package | Exported API |
|---|---|
| `internal/domain/traceguard/core/services/detection` | `Evaluator{}.Detect(ctx context.Context, events []entities.Event, graph entities.Graph, policy entities.Policy) ([]entities.Finding, error)` |
| `internal/domain/traceguard/core/services/investigation` | `New(provider Provider) Service`, `Service.Explain(ctx context.Context, finding entities.Finding, ruleSummary string, supplied []Evidence) Result` |
| `internal/adapters/ai` | `New(apiKey, model string, timeout time.Duration, client *http.Client) *Client`, `(*Client).Suggest(ctx context.Context, input investigation.Request) (investigation.Suggestion, error)` |

## Analyze

Pass `detection.Evaluator{}` as the fourth argument of the BE1 HTTP
`Register` call. It implements the existing `ports.Detector`. The analyze
handler already sends normalized events, graph and policy through that port.

Example input is completed `DATA_SENT` event `evt-003` from `sales-api` to
`external-crm` with classification `PII` and purpose `MARKETING`, and a
matching observed edge citing `evt-003`. The PII policy allows only
`sales-api` and `customer-api` as destinations and `CUSTOMER_SERVICE`
as a purpose. Expect a finding with rule `DENY_EXTERNAL_PII`, status
`VERIFIED_VIOLATION`, evidence `["evt-003"]`, empty missing evidence, and a
message identifying both policy conditions. A purposeful denial at an allowed
destination uses `DENY_PURPOSE`. The evaluator requires matching endpoints
and an event ID on an observed edge as well as the completed send itself.

## Explain

Keep analyze deterministic and invoke investigation from the separate stateless
`POST /api/v1/explain` handler. BE1 can add the route to the shared spec and
regenerate the bindings. Map the selected finding into `entities.Finding`.
Pass the trusted rule summary and redacted evidence as `investigation.Evidence`
values containing only `EventID`, `Action`, and `Outcome`. Call
`Explain` with the request context. Map the result to `explanation`,
`next_steps`, `evidence_event_ids`, and `mode`.

Use `investigation.New(nil)` for offline mode. For AI mode, read
`OPENAI_API_KEY` and `TRACEGUARD_OPENAI_MODEL` in the BE1 composition root
and pass them to `ai.New`. Select an authorized model that supports Chat
Completions JSON mode. Construct the provider only when both settings are
present. The adapter defaults to three seconds, caps its timeout at five
seconds, and propagates request cancellation. No new dependency is required.

The model receives a fixed contract classification, temporary evidence aliases
and allowlisted action/outcome labels. It chooses ordered next steps from vetted
options. The service renders the explanation and preserves the evaluator's
classification and valid citations in both modes. Invalid provider output,
failure and timeout all produce the same deterministic fallback.
