# Codex — BE1: Go Framework Lead + Lineage

Read `AGENTS.md`, `PLANS.md`, `docs/01-architecture.md`, `docs/02-api-contract.md`, `docs/03-event-schema.md`, `docs/04-team-ownership.md`.

During official build time create a fresh, public-module Go service: Echo router, OpenAPI spec, oapi-codegen generated types/glue, simple config, healthz and analyze handler. Own `backend/cmd/`, `backend/docs/`, `backend/go.mod`, `backend/Makefile`, `internal/config/`, shared entities/ports, lineage, fixture adapter. **Merge a compilable skeleton by 10:40**; do not wait for a finished graph. Implement correlation and graph reconstruction, deterministic ordering, observed/inferred evidence. Integrate BE2's pure detection service later. Never modify generated files directly; no private imports. Run go test and go vet with exact evidence.

Keep primary Go APIs minimal and coordinate type names early with BE2.
