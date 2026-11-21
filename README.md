# TraceGuard AI — Hackathon Team Workspace

**Build:** Sea × OpenAI Regional Codex Hackathon Thailand — 21 Nov 2026, 10:00–17:00 (Bangkok time)  
**Team:** 4 engineers (FE1 framework / FE2 investigation / BE1 framework / BE2 detection & AI).  
**Product:** Detect privacy risks that are invisible in isolated audit events by reconstructing evidence-backed data lineage.

## Clean-room boundary

This repository was planned **from scratch**. The attached internal Go-service guidance informed only general engineering ideas (API-first, generated HTTP contracts, separation of concerns, table-driven tests). It does **not** contain private repository source, proprietary Go packages, internal URLs, configuration, credentials, or copied template files. No private repository or private modules may be used for this hackathon project without explicit authorization. Only public and approved dependencies should be introduced.

## What is in this pack?

Planning-only Markdown, Codex task prompts, and empty directory placeholders. **There is no application code, no generated API code, and no runnable starter.** Implement those pieces during the official build window, subject to the organizer's rules. If the organizer clarifies different limits on preparation, follow their rules.

## Decisions

- **Repo:** One independent GitHub monorepo named `traceguard-ai`.
- **Frontend:** React + TypeScript + Vite + React Flow (public packages).
- **Backend:** Go + Echo (public module), OpenAPI-first, `oapi-codegen`, single binary; domain-first design.
- **Data:** Synthetic JSON fixtures + in-memory processing; no database / Kafka / Kubernetes in MVP.
- **AI:** Optional OpenAI runtime API for evidence-based explanations, with a deterministic fallback.
- **Workflow:** Codex-first, focused testing, small PRs, fast integration; Superpowers not required.

## Reading order

1. `PLANS.md` — seven-hour execution plan and time gates
2. `docs/01-architecture.md` — repository tree and boundaries
3. `docs/02-api-contract.md` and `docs/03-event-schema.md` — contracts to freeze
4. `docs/04-team-ownership.md` and `docs/07-sprint-board.md` — four-way parallel plan
5. `AGENTS.md` and `prompts/` — instructions for Codex sessions
6. `docs/09-demo-script.md` — judge-facing demo

## Build-day developer commands (targets, not prebuilt)

- Backend: `cd backend && go test ./... && go run ./cmd/traceguard-api`
- Frontend: `cd frontend && npm install && npm run dev`
- Quality gates: `go test ./...`, `go vet ./...`, `npm run build`
- API generation: configure `make gen-api` from an event-day OpenAPI spec; never manually edit generated code.

## GitHub

Create the GitHub repository manually (visibility based on approved materials), upload these planning docs, then create GitHub Project and Issues from `docs/07-sprint-board.md`. No remote repository has been created by this pack.
