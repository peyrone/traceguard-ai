# Quality Gates

## Domain correctness (BE1/BE2)
- `go test ./...` passes; write table-driven tests for 4 scenarios.
- `go vet ./...` passes.
- Permutation order is irrelevant, missing links are not fabricated, evidence IDs refer to input.
- `ATTEMPTED` and `FAILED` do not become `COMPLETED`.
- No raw PII in logs or LLM prompts.

## API correctness (BE1)
- OpenAPI spec and generated transport match.
- `400` for malformed/invalid inputs, `5xx` only for server errors.
- Health endpoint works.
- OpenAI failures do not make `/analyze` unavailable.

## UI correctness (FE1/FE2)
- `npm run build` succeeds; optional `npm run test` if configured.
- Normal/error/loading states are visible and understandable.
- Inferred edges use a different style from observed edges.
- Evidence IDs are inspectable without revealing personal data.

## End-to-end
- GET scenarios, POST analyze S01/S02/S03/S04, POST explain (or fallback).
- Re-run clean install and demo without requiring proprietary infrastructure.

## Timing
- First end-to-end by 12:30.
- Feature freeze by 15:00.
- Submit by 17:00.
