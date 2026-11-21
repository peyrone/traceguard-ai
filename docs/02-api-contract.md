# API Contract v0 (Design Blueprint; formal OpenAPI written on build day)

**Base:** `/api/v1`  **Format:** JSON  **Errors:** `{ "code": "...", "message": "..." }`  **Health:** `GET /healthz`.

## Endpoints

| Method | Path | Purpose | Owner |
|---|---|---|---|
| GET | `/api/v1/scenarios` | List available synthetic scenarios | BE1 |
| POST | `/api/v1/analyze` | From events + policy to graph and findings | BE1 integrates BE2 |
| POST | `/api/v1/report-summary` | Generate a case report for an audience in English or Thai | BE1 + BE2 / FE1 + FE2 |
| POST | `/api/v1/explain` | Explain selected finding from supplied safe evidence | BE2 |

| POST | `/api/v1/privacy/decisions` | Evaluate a demo policy and conditionally execute a synthetic transfer | BE1 integrates enforcement and FE2 |

No `analysis_id` needed for MVP; explanation is stateless.

## `POST /api/v1/analyze`

Request:

```json
{
  "scenario_id": "unauthorized_transfer",
  "events": [],
  "policy": {
    "policy_id": "policy-001",
    "classification": "PII",
    "allowed_destinations": ["sales-api", "customer-api"],
    "allowed_purposes": ["CUSTOMER_SERVICE"]
  }
}
```

Callers supply either `scenario_id` or explicit `events` and `policy` (choose one mode; clarify in OpenAPI). Start with scenario IDs to save time, and enable custom logs only after P0.

With a valid policy and no `scenario_id`, `events: []` returns HTTP 200 with `summary.status` set to `INCONCLUSIVE` and `events_processed` set to 0. With a `scenario_id`, an empty array as shown above loads the scenario's events.

Response:

```json
{
  "summary": {"status":"VERIFIED_VIOLATION", "events_processed":3},
  "graph": {
    "nodes": [{"id":"sales-api", "label":"Sales API", "kind":"internal"}],
    "edges": [{"id":"edge-1", "source":"sales-api", "target":"external-crm", "evidence_status":"OBSERVED", "evidence_event_ids":["evt-003"]}]
  },
  "findings": [
    {"id":"finding-1", "rule_id":"DENY_EXTERNAL_PII", "status":"VERIFIED_VIOLATION", "message":"Completed transfer to an unapproved destination", "evidence_event_ids":["evt-003"], "missing_evidence":[]}
  ]
}
```

Fixture-backed analysis with the server-owned policy also returns `transfer_candidates`. Each entry has a scenario-scoped `id`, `edge_id`, directed `source_service` and `destination_service`, `evidence_status`, `evidence_event_ids`, and `policy_id`. Observed entries correspond to individual completed send records and include their `classification` and `purpose` when present. Inferred entries expose the graph relationship and its supporting IDs without inferring a classification or purpose for a completed send. The field is omitted for custom events or policy overrides.

Rules:
- `OBSERVED` means a completed transfer is directly logged with event IDs; `INFERRED` means the relationship is hypothetical and must not be treated as confirmed.
- A completed directly observed transfer to a denied destination may be **verified**, even when an upstream link is missing.
- An incomplete attribution path must not be claimed as a verified end-to-end lineage.
- An empty or truncated audit set yields no guarantee of safety.

## `POST /api/v1/explain`

Input: selected finding, rule summary, redacted synthetic evidence summaries. Do not send raw personal data to an LLM.

Output: `{ "explanation": "...", "next_steps": ["..."], "evidence_event_ids": ["evt-003"], "mode": "ai" }` where `mode` is `ai` or `fallback`.

If OpenAI API is unavailable, serve a deterministic explanation referencing the same evidence IDs. Preserve timeouts.

For a matched server-owned scenario, the response can also include `insights` and `gdpr_mappings`. Insights contain a `kind` (`observation`, `policy_concern`, or `uncertainty`), `text`, and `evidence_event_ids`. A GDPR mapping includes a curated `reference` (article with paragraph and point, official title, applicability criteria, official source and guidance URLs), `assessment` (`potential_concern` or `insufficient_information`), `rationale`, `evidence_event_ids`, and `missing_facts`.

Nested citations can reference related scenario evidence and do not change the selected finding's top-level citations or evaluator verdict. Mappings are investigative assessments. An empty or omitted mapping list conveys no conclusion about legal compliance. Official URLs come from the server's curated reference. In `ai` mode, the provider has successfully prioritised validated actions and, when supplied, server-grounded insights and mappings. In `fallback` mode, Go renders the deterministic results.

## `POST /api/v1/privacy/decisions`

The operation evaluates a server-owned demo policy and invokes the synthetic executor only on `ALLOW`. It sends no customer data and makes no external transfer. Its result records a simulated attempt and supplies no historical lineage evidence.

For the dashboard, send only `scenario_id` and the selected `candidate_id` from that scenario's analysis. The server reloads the scenario, re-resolves the candidate, and evaluates the scenario's own policy. Inferred transfers and observed transfers with insufficient decision attributes return `INDETERMINATE` with `transfer_executed=false`. Unknown scenarios and unknown or foreign candidates return HTTP 404 with the standard error envelope. An incomplete pair of references or a mixture of references and explicit transfer attributes returns HTTP 400.

The legacy explicit-attribute request remains available for existing callers:

```json
{
  "source_service": "sales-api",
  "destination_service": "external-crm",
  "data_categories": ["PII"],
  "purpose": "CUSTOMER_SERVICE",
  "policy_id": "policy-001"
}
```

Response for the example:

```json
{
  "decision": "DENY",
  "rule_id": "DENY_EXTERNAL_PII",
  "reason": "Destination is not permitted by the privacy policy.",
  "transfer_executed": false
}
```

A valid JSON request returns HTTP 200 with `ALLOW`, `DENY`, or `INDETERMINATE`. Missing decision attributes, uncovered categories, or unavailable policy return `INDETERMINATE` and block the simulation. `transfer_executed` is true only after the synthetic executor produces a receipt. Malformed or incorrectly typed requests return HTTP 400 with the standard error envelope.

## `POST /api/v1/report-summary`

Send `{"scenario_id":"partial_evidence_confirmed","audience":"executive","language":"th"}`. Supported audiences are `executive` and `engineering`. Languages are `en` and `th`. The server loads its scenario and policy, runs the same analysis as the workspace, and echoes these three request fields with the canonical `status`, `mode`, and ordered `sections`. Each section has a `kind` (conclusion, uncertainty, route, action), localized `text`, an array of `evidence_event_ids`, and optionally a `rule_id`.

Both editions retain the evaluator verdict. The executive edition identifies a decision and suggested owner. Engineering includes observed and inferred links with their citations. AI may prioritize approved follow-ups from redacted evidence. Missing configuration, provider failure or invalid suggestions produce HTTP 200 with deterministic `mode: fallback`. Malformed requests return 400, unknown cases 404, and analysis failures 500 with the standard error envelope.

## Frontend component contracts

```text
<LineageGraph graph={Graph} selectedFindingId={string|null} onSelectNode={(id)=>...} />
<InvestigationPanel findings={Finding[]} onSelectFinding={(id)=>...} />
<ScenarioSelector scenarios={Scenario[]} onChange={(scenarioID)=>...} />
```

FE1 owns composition and graph. FE2 owns investigation UI and API client types. Changes to prop shape are contract changes and require FE1+FE2 agreement.
