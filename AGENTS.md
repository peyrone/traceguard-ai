# Codex Repository Instructions — TraceGuard AI

## Non-negotiable
- This is an **independent clean-room hackathon project**. Never read, copy, import, or depend on a private/corporate repository, internal modules, corporate SDK, or internal templates.
- Follow official event rules and produce substantive new application code during the competition window.
- Treat `docs/02-api-contract.md` and `docs/03-event-schema.md` as the design baseline. If a contract must change, ask the release captain and update docs in a dedicated PR before modifying consumers.
- Follow the file ownership map in `docs/04-team-ownership.md`. Never edit another person's owned files without coordination.
- Do not introduce DB, Kafka, Kubernetes, authentication, formal verification, or policy DSL unless explicitly approved.
- No actual PII in fixtures or logs. Use synthetic values and opaque IDs; redact all API credentials.
- Do not claim inferred events are observed. Mark evidence links explicitly and maintain traceability to event IDs.

## Engineering approach
- Backend: Go with public Echo and oapi-codegen packages; OpenAPI specification is the source of truth for HTTP contracts.
- Generated code lives under `backend/cmd/traceguard-api/handlers/http/api_gen/` and is never manually edited.
- Keep transport separate from domain services. Domain service packages must not import Echo or HTTP DTOs.
- Pass context.Context as the first parameter of blocking operations. Wrap errors using `%w` and map them to HTTP status codes in handlers.
- Use small, explicit interfaces near the consumers and constructor injection.
- Prefer Go table-driven tests, including shuffled-order determinism and missing-evidence cases.
- Frontend: React TypeScript; UI components accept typed props and can run on deterministic mock fixtures prior to API integration.
- Make minimal changes and run available tests before PR. Report commands actually run and exact results, not guesses.

## Codex task format
1. Read README, PLANS, contract, scenario and your owner prompt.
2. State a short file-scoped plan (3–5 steps).
3. Implement smallest vertical slice, add a test, run verification.
4. Summarize changed files, test evidence, blockers, contract changes required.

## Scope priorities
P0: observed unauthorized transfer, graph, evidence, frontend integration, runnable local demo.
P1: out-of-order, missing-evidence classification, AI explanation/fallback.
P2: animations, advanced filters, persistence, streaming, cloud deployment.

## Release rule
Merge only through small PRs after `go test ./...`, `go vet ./...`, or `npm run build` as applicable. Freeze features when the first end-to-end demo is stable; prioritize evidence correctness over UI polish.
