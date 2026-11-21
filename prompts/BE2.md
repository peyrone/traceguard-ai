# Codex — BE2: Privacy Detection + AI Investigation

Read `AGENTS.md`, `docs/02-api-contract.md`, `docs/03-event-schema.md`, `docs/05-scenarios.md`, `docs/04-team-ownership.md`.

Start immediately: outline table-driven tests and implement a pure Go policy evaluator in your owned `backend/internal/domain/traceguard/core/services/detection/` package (plus own tests). Use agreed shared domain entity names; coordinate with BE1, but do not modify his files. Evaluate allowed destinations/purposes; distinguish verified, potential, inconclusive, and no violation observed. No claim of completed transfer without supporting evidence. After P0 works, add an evidence-based explanation service under `services/investigation/` and `adapters/ai/` with a deterministic fallback and timeout. Never edit shared OpenAPI/spec, main.go, generated files or go.mod; request BE1 to integrate. Run tests and report actual output.
