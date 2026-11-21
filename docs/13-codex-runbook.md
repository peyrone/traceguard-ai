# TraceGuard AI — Four-person Codex Command Runbook

**Event:** Sea x OpenAI Regional Codex Hackathon Thailand — 21 November 2026 (10:00–17:00 ICT)

**Scope:** Original, clean-room implementation. No code or dependencies from a corporate/private Go repository. Use only public open-source packages. This document is a planning artifact, not application code.

## 0. Team working agreement

| Engineer | Branch | Allowed writes | Required first gate |
|---|---|---|---|
| FE1 | `feat/fe-framework-graph` | `frontend/src/app/`, `frontend/src/features/lineage/`, frontend root configs | React/Vite bootable shell by 10:40 |
| FE2 | `feat/fe-investigation` | `frontend/src/features/investigation/`, `frontend/src/lib/api/`, `frontend/src/lib/fixtures/` | Standalone mock-based panels by 10:40 |
| BE1 | `feat/be-framework-lineage` | `backend/go.mod`, `backend/Makefile`, `backend/cmd/`, `backend/docs/`, `backend/internal/config/`, `backend/internal/domain/traceguard/core/{entities,ports,services/lineage}/`, `backend/internal/adapters/fixtures/` | Echo + OpenAPI + healthz boot by 10:40 |
| BE2 | `feat/be-detection-ai` | `backend/internal/domain/traceguard/core/services/{detection,investigation}/`, `backend/internal/adapters/ai/`, owned tests | Pure detection logic and table tests by 10:40 |

Keep the agreed contract in `docs/02-api-contract.md` and `docs/03-event-schema.md` stable. BE1 owns generated API bindings. FE1 owns frontend app composition. A release captain merges PRs and decides scope changes.

**No one waits for framework owners.** FE2 begins with typed synthetic fixtures and exported components without touching app shell. BE2 begins with pure Go evaluator and local package tests, using agreed domain contract; BE1 provides integration types/interfaces at first framework merge.

## 1. Setup (per member)

```bash
git clone <YOUR_GITHUB_REPO_URL> traceguard-ai
cd traceguard-ai
codex --version
# Choose exactly one branch for your assigned role:
git switch -c feat/fe-framework-graph    # FE1
# git switch -c feat/fe-investigation   # FE2
# git switch -c feat/be-framework-lineage # BE1
# git switch -c feat/be-detection-ai    # BE2
codex
```

Enter prompts below in an interactive Codex conversation. All prompts require Codex to inspect repository instructions, propose a file-scoped plan, implement only owned files, run real tests, and report verified results. Never ask it to silently change a shared contract.

## 2. FE1 — Frontend Framework Lead

### Prompt A — 10:15–10:40: minimal scaffold

```text
You are FE1 (Frontend Framework Lead) on branch feat/fe-framework-graph.
Read AGENTS.md, PLANS.md, docs/01-architecture.md, docs/02-api-contract.md,
docs/04-team-ownership.md, docs/05-scenarios.md, and prompts/FE1.md.

Task TG-02: During the official hackathon build window, create a fresh public-package
React + TypeScript + Vite frontend under frontend/. Add a bootable single-page app
shell with a reserved slot for <LineageGraph> and FE2's investigation components.
Keep routing/state minimal; use no private code or packages.

Ownership: frontend root configs, frontend/src/app/, frontend/src/features/lineage/.
Do NOT modify FE2's feature, lib/api, or lib/fixtures directories.
Use the agreed frontend component props in docs/02-api-contract.md.

Timebox: 25 minutes. First state a 3-step plan; implement only the scaffold;
run npm install and npm run build; report files changed and actual results.
Stop when the app boots. Do not build the whole dashboard yet.
```

### Prompt B — 10:40–12:30: graph + composition

```text
Continue as FE1. Read the current API contract and current main branch state.
Implement TG-07 and TG-10 in owned files: a React Flow LineageGraph that accepts
graph nodes/edges and a selected finding, shows source/target services, highlights
the selected route, and visually distinguishes OBSERVED from INFERRED edges.
Observed links must show supporting event IDs; inferred links must never look
confirmed. Integrate FE2's exported components through app composition only after
the bootstrap PRs are merged. Use typed mock data until the API is available.
Run npm run build and relevant tests. Report exactly what is verified.
Do not edit FE2-owned files or invent API fields.
```

## 3. FE2 — Investigation Feature Lead

### Prompt A — 10:15–10:40: mock-first independent feature

```text
You are FE2 (Investigation Feature Lead) on branch feat/fe-investigation.
Read AGENTS.md, docs/02-api-contract.md, docs/03-event-schema.md,
docs/05-scenarios.md, docs/04-team-ownership.md, and prompts/FE2.md.

Task TG-04: Implement framework-independent, exported typed React/TypeScript
components only in frontend/src/features/investigation/ and
frontend/src/lib/{api,fixtures}/: ScenarioSelector, FindingsPanel, EvidencePanel.
Use deterministic synthetic fixtures matching the contract. Components must
accept props; do not import the app shell or require a live backend. Include
empty, loading, and error modes. Provide a simple usage example for FE1.

Do NOT modify frontend package.json, App.tsx, frontend/src/app/, frontend
root configs, or LineageGraph. If the scaffold does not exist, develop standalone
.ts/.tsx modules and report unverified compile steps honestly.
Write a 3-step file-scoped plan, implement, and summarize exported interfaces.
```

### Prompt B — 10:40–13:45: typed client + AI explanation panel

```text
Continue as FE2. Implement TG-09 and TG-14 in your owned directories.
Create a typed API client for GET /api/v1/scenarios, POST /api/v1/analyze,
and POST /api/v1/explain, matching docs/02-api-contract.md exactly.
Preserve a mock-mode adapter for development; make loading, failure, and AI
fallback states explicit. Export InvestigationPanel and ScenarioSelector for FE1
integration. Ensure findings show actual evidence_event_ids and that INFERRED
edges never count as direct transfer proof. Ask BE1 before any API field change.
Once the FE scaffold is merged, run npm run build and report the result.
Do not change app composition; request FE1 to wire the exports.
```

## 4. BE1 — Backend Framework Lead

### Prompt A — 10:15–10:40: contract and bootable service

```text
You are BE1 (Backend Framework Lead) on branch feat/be-framework-lineage.
Read AGENTS.md, PLANS.md, docs/01-architecture.md, docs/02-api-contract.md,
docs/03-event-schema.md, docs/04-team-ownership.md, docs/10-codegen-guide.md,
and prompts/BE1.md.

Task TG-03: Create an ORIGINAL public-dependency Go service under backend/.
Use Echo and OpenAPI-first development. Author
backend/docs/traceguard-api/doc.yaml first, then pin a public oapi-codegen
version, generate transport types/router code under
backend/cmd/traceguard-api/handlers/http/api_gen/, and implement GET /healthz.
Keep main.go small; add Go module and Makefile with gen-api/test targets.
Create the minimum shared domain entities needed by BE2 and communicate their
exact package/import paths and struct fields to BE2. Never hand-edit api_gen.

Do not import/copy corporate or private repository packages. Do not add
SQL, Kafka, auth, or unnecessary infrastructure. Timebox to 25 minutes:
server boots, codegen runs, go test ./... and go vet ./... as applicable.
Report actual results and missing pieces. Stop before lineage feature work.
```

### Prompt B — 10:40–12:30: lineage and analyzer

```text
Continue as BE1. Implement TG-06 and TG-08 in your owned Go packages.
Implement normalization/deduplication, trace and transfer correlation, and a
stable directed service graph from the agreed synthetic audit event schema.
Observed completed DATA_SENT transfers must reference real evidence_event_ids.
Mark unverified relationships as INFERRED; do not make up missing events.
A shuffled input must produce equivalent graph and findings. Add table-driven
unit tests. Wire POST /api/v1/analyze to BE2's exported pure detection service
only after its PR is merged. Implement GET /api/v1/scenarios from synthetic
fixtures. Keep HTTP DTOs out of domain logic.

Run make gen-api, go test ./..., go vet ./..., and local healthz/analyze smoke
requests. Report exact test output and current integration blockers.
```

## 5. BE2 — Detection & AI Lead

### Prompt A — 10:15–10:40: pure rules first

```text
You are BE2 (Detection & AI Lead) on branch feat/be-detection-ai.
Read AGENTS.md, docs/02-api-contract.md, docs/03-event-schema.md,
docs/05-scenarios.md, docs/04-team-ownership.md, and prompts/BE2.md.

Task TG-05: Build a pure, deterministic privacy policy evaluator and Go
table-driven tests under your owned services/detection directory only.
Handle permitted vs unapproved destination/purpose; distinguish COMPLETED,
ATTEMPTED, and FAILED outcomes. Statuses:
VERIFIED_VIOLATION, POTENTIAL_VIOLATION, INCONCLUSIVE,
NO_VIOLATION_OBSERVED. Ensure each verified finding references a real completed
transfer event. No fabricated evidence; no claim that missing evidence is proof.

Do not modify Go module, shared domain entities, HTTP handlers, OpenAPI spec,
or generated code. Agree on type names with BE1; if shared entities are not yet
on your branch, implement logic against minimal package-local test fixtures and
adapt after the 10:40 scaffold merge. Timebox 25 minutes. Write tests first;
run what can actually run; report compile blockers truthfully.
```

### Prompt B — 10:40–13:45: integration-safe AI investigator

```text
Continue as BE2. Finish TG-05 then implement TG-12 and TG-13 in your owned
services/detection, services/investigation, and adapters/ai directories.
Expose a pure evaluator function suitable for BE1's analyze handler.
Support missing-evidence uncertainty without inventing links.

Implement an evidence-grounded explanation service for POST /api/v1/explain.
The service should accept only redacted finding, policy summary and synthetic
event IDs; optional public OpenAI API is allowed as runtime functionality.
Use context timeout, avoid sensitive payloads, never create new evidence IDs,
and provide deterministic fallback when credentials/network are absent.
Return {explanation, next_steps, evidence_event_ids, mode} where mode is ai
or fallback. Ask BE1 to wire the API; do not edit handler or OpenAPI files.

Run table-driven tests for allowed, unauthorized completed, attempted,
out-of-order, missing-link and fallback cases. Report actual results and any
required API contract changes for BE1 approval.
```

## 6. Shared integration command (after 10:40 bootstrap merges)

Have the release captain merge FE1 and BE1 bootstrap PRs into main. Each engineer syncs their own branch from main, resolving only their own conflicts and never discarding others' changes:

```bash
git fetch origin
git merge origin/main
```

Then in Codex, each person enters:

```text
Read AGENTS.md and docs/02-api-contract.md. Inspect my branch against
origin/main. Only integrate my assigned feature. Do not change shared schema
or files owned by another engineer. Run relevant tests/build and tell me:
(1) changed files, (2) verified command output, (3) dependencies/blockers,
(4) exact PR description and handoff instructions. Do not merge to main.
```

## 7. PR checklist and release captain prompt

```text
You are Release Captain. Read AGENTS.md, PLANS.md, docs/05-scenarios.md,
docs/07-sprint-board.md, docs/09-demo-script.md, and prompts/RELEASE.md.
Review open PR integration status; identify overlaps, build or contract changes,
and issue a small prioritized correction plan. Verify on merged main:
backend: go test ./..., go vet ./..., and go server smoke tests;
frontend: npm run build and scenario UI smoke checks.
Check no private dependencies, corporate source, actual PII, secrets, or
fabricated evidence. Verify S01 normal; S02 unauthorized completed transfer;
S03 shuffled order same finding; S04 missing evidence remains uncertain.
If optional AI fails, explain should return deterministic fallback.
Do not introduce features after 15:00. Report verified results, risks,
and exact demo/submission commands. Never claim tests ran if they did not.
```

## 8. Time gates

| Time (ICT) | Decision gate |
|---|---|
| 10:00–10:15 | Confirm contract and ownership, initiate 4 Codex sessions |
| 10:15–10:40 | FE1 + BE1 create bootable framework PRs; FE2 + BE2 independently build features/tests |
| 10:40–11:35 | All four build features; sync from main immediately after scaffold merges |
| 11:35–12:30 | First FE → BE end-to-end graph + verified policy finding |
| 12:30–13:45 | Out-of-order, missing evidence, AI fallback |
| 13:45–15:00 | Regression and evidence correctness checks |
| 15:00–16:45 | Feature freeze, demo rehearsal, release verification |
| Before 17:00 | Submit working main branch and demo artifacts |

## 9. If blocked

- If no compile-ready Go shared entity at 10:40, BE2 tests pure package-local evaluation and hands BE1 explicit adapter signature; no waiting.
- If frontend shell missing at 10:40, FE2 exports typed components and fixture snapshots without touching app shell.
- If P0 not working by 12:30, stop adding AI and advanced missing-event handling; fix the observed-unauthorized-transfer end-to-end path.
- If oapi-codegen tooling is blocked, prioritize a working public Echo handler and record the deviation; never use private template code.
- If AI credentials/timeouts fail, use deterministic explanation with the same evidence event IDs.

**Source documents in repo:** `AGENTS.md`, `PLANS.md`, `docs/01-architecture.md`, `docs/02-api-contract.md`, `docs/03-event-schema.md`, `docs/04-team-ownership.md`, `docs/05-scenarios.md`, `docs/07-sprint-board.md`, `prompts/{FE1,FE2,BE1,BE2,RELEASE}.md`.
