# TraceGuard AI — Feem (FE1) Plan: App Shell, Graph and Integration

> Execution handoff: Feem (FE1) and Aom (FE2) implement their own tasks concurrently in one repository, using separate branches/checkouts. Track the checkboxes below. This is a planning deliverable, not authorization to change frozen HTTP contracts or another owner's files.

**Goal:** Deliver one responsive investigation workspace where a synthetic scenario produces an evidence-backed graph, selectable findings, evidence inspection, and an optional explanation with deterministic fallback.

**Architecture:** One React application at `frontend/` inside the existing `traceguard-ai` monorepo. Feem (FE1) owns composition and graph rendering; Aom (FE2) owns typed client, fixtures, request behavior and investigation components. The backend remains the authority for findings and evidence classifications.

**Tech stack:** React, TypeScript, Vite, React Flow (`@xyflow/react`); Vitest, React Testing Library and jsdom for focused tests. No additional router or global state framework for MVP. Feem (FE1) owns dependency changes and the lockfile.

**Baseline:** Read `README.md`, `PLANS.md`, `AGENTS.md`, `docs/00-scope.md`, `docs/02-api-contract.md`, `docs/03-event-schema.md`, `docs/04-team-ownership.md`, `docs/05-scenarios.md`, `docs/09-demo-script.md`, and `prompts/FE1.md` before implementation.

**Visual reference:** https://traceguard-investigation-mockup.ifeemily.chatgpt.site

The published site is a synthetic, browser-local visual prototype. Reimplement the intended experience in React; its scripted interactions, fixture IDs and graph geometry are not the HTTP contract. Match the reference's light technical workspace, evidence hierarchy and responsive structure. Do not transfer its prototype-only preview-state toolbar into the normal application.

## Start here

1. Read this handoff and the baseline documents above. The [master plan](2026-11-21-frontend-master-plan.md) coordinates both developers; this file contains your assigned work.
2. Use branch `codex/fe1-shell-graph` in your own checkout/worktree of the same repository.
3. Agree the proposed interface changes below with the other frontend developer before coding consumers.
4. Execute your tasks in order; keep all work within your write paths.
5. Report exact test/build results and blockers in each small PR; ask the other developer to review.

## Your write paths

- `frontend/package.json`, `frontend/package-lock.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig*.json`, `frontend/.env.example`, `frontend/.gitignore`.
- `frontend/src/app/`: `main.tsx`, `App.tsx`, `Workspace.tsx`, `tokens.css`, `workspace.css`, `App.test.tsx`, `testSetup.ts`.
- `frontend/src/features/lineage/`: `LineageGraph.tsx`, `ServiceNode.tsx`, `NodeDetails.tsx`, `layout.ts`, `selection.ts`, `lineage.css`, `layout.test.ts`, `selection.test.ts`.

Aom (FE2) owns `frontend/src/features/investigation/` and `frontend/src/lib/{api,fixtures}/`. Do not edit those files. Request exports or DTO changes from Aom (FE2). You own package and lockfile updates requested by Aom (FE2). Backend files and generated handlers remain outside your scope.

Consume Aom (FE2)'s `createMockClient()`, `createApiClient(baseUrl)`, `useInvestigation(client)` and investigation components. The hook owns scenario-list/request/selection/explanation state; do not duplicate that state in App. Derive selected finding and highlighted edges in composition. Before Aom (FE2) exports land, use Feem (FE1)-local graph test inputs; do not create competing shared types.

### Shared Git agreement


1. Use one remote and one `frontend/package.json`; do not create a second frontend application. Use separate local clones or Git worktrees, never simultaneous branch switches in a shared checkout.
2. Feem (FE1) begins `codex/fe1-shell-graph`; Aom (FE2) begins `codex/fe2-investigation-client`. Split subsequent reviewable changes onto focused branches if useful. One task/issue, one focused PR.
3. Feem (FE1) merges the bootable scaffold early. Aom (FE2) can write typed modules and fixtures immediately, then update from main after scaffold merge to run them. Feem (FE1) alone resolves package/lockfile changes.
4. Each author builds and runs relevant tests before requesting review. The other frontend developer reviews; merge through small PRs and update from main after each dependency lands. Do not force-push shared branches or overwrite the other owner's changes.
5. PR descriptions state changed paths, behavior, exact commands/results and remaining dependencies. Contract changes go to the release captain in a dedicated contract PR before consumers change.


## 1. Scope and correctness rules

| Priority | Deliverable | Done when |
| --- | --- | --- |
| P0 | Scenario → analysis → graph → finding → evidence | A real backend response drives the complete flow; explicit mock mode also works independently. |
| P0 | Responsive shell and request recovery | Loading, idle, empty, error and retry states work at 1440px, 1024px and 390px. |
| P1 | Shuffled logs and missing evidence | S02/S03 yield equivalent topology and stable placement; S04 never fabricates observed links. |
| P1 | Explanation and fallback | Selected finding receives evidence-backed prose, next steps and an `ai`/`fallback` label. |
| Deferred | Advanced filters, uploads, animation, history, streaming, deployment | Excluded until P0/P1 are stable and scope is explicitly reopened. |

1. Use only public dependencies and original clean-room application code; comply with competition rules. No actual PII, credentials in fixtures/logs, database, authentication, Kafka, Kubernetes, policy DSL or formal verification.
2. Render nodes and edges from supplied analysis data only. `OBSERVED` is a directly logged completed transfer with supporting event IDs; `INFERRED` remains hypothetical. Attempted/failed transfers cannot count as completed exfiltration.
3. A direct forbidden transfer can be verified despite an upstream gap. Do not imply that the full upstream lineage is verified. Render the backend's status without upgrading or silently reclassifying it in the client.
4. Use the exact four status values. For `NO_VIOLATION_OBSERVED`, include “Available events do not prove compliance.” Never invent severity scores, compliance percentages, timestamps, payloads or raw event records.
5. Keep mode explicit. An API error never silently substitutes mock results. AI unavailability may produce a backend-provided deterministic fallback; an HTTP/network failure remains a retryable error unless a separately agreed local fallback exists.

## Shared interfaces — agree before implementation


The following existing component contracts remain the baseline:

```tsx
<LineageGraph graph={graph} selectedFindingId={selectedFindingId} onSelectNode={onSelectNode} />
<InvestigationPanel findings={findings} onSelectFinding={onSelectFinding} />
<ScenarioSelector scenarios={scenarios} onChange={onChange} />
```

**Important dependency:** `selectedFindingId` plus `graph` cannot establish finding-to-evidence mapping on its own. Feem (FE1)/FE2 must agree an additive UI prop or context before implementing highlighting. This plan proposes `highlightedEdgeIds: string[]` on `LineageGraph`, derived in Feem (FE1) composition from the selected finding's event IDs. It is a proposal, not an approved contract amendment. Retain the baseline props. No hidden graph fetch and no inference from finding ID naming.

Other proposed UI-only props, also requiring Feem (FE1)/FE2 agreement:

| Component/export | Proposed signature or fields | Purpose |
| --- | --- | --- |
| `ScenarioSelector` | Add `value: string \| null`, `disabled?: boolean` | Controlled selection and loading state. |
| `InvestigationPanel` | Add `selectedFindingId: string \| null`, `onSelectEvidence: (eventId: string) => void` | Visible selection and evidence interaction. |
| `AnalysisSummary` | `{ summary: AnalysisResponse['summary'] }` | Exact status copy and event count. |
| `EvidenceDetails` | `{ finding: Finding, graph: Graph, selectedEventId: string \| null }` | Returned evidence IDs, matching edges, gaps. |
| `ExplanationPanel` | `{ finding: Finding, state: ExplanationState, onExplain: () => void }` | Evidence-scoped explanation, retry and mode label. |

Aom (FE2) owns HTTP DTOs in `types.ts`. Derive them from BE1's formal OpenAPI once available. Do not invent scenario IDs or an explain request shape for API mode.

The typed client interface proposal is:

```ts
interface InvestigationClient {
  listScenarios(signal?: AbortSignal): Promise<Scenario[]>;
  analyzeScenario(scenarioId: string, signal?: AbortSignal): Promise<AnalysisResponse>;
  explainFinding(request: ExplainRequest, signal?: AbortSignal): Promise<ExplainResponse>;
}
```

`Scenario` and `ExplainRequest` must match the confirmed backend schema; they are not defined by this plan. `AnalysisResponse`, `Graph`, `Finding` and `ExplainResponse` reflect the frozen contract. API calls map to `GET /api/v1/scenarios`, `POST /api/v1/analyze` and `POST /api/v1/explain`. Confirm scenario-only analyze request mode with BE1; omit explicit events/policy in that mode once agreed. Never create new endpoints to make a component easier to build.

- [ ] Feem (FE1)/FE2 record agreed component props, exports and selection mapping in the PR description or linked decision record.
- [ ] BE1 confirms scenario-list response, scenario IDs and analyze request mode; BE2/BE1 confirm explain request and timeout/error behavior in formal OpenAPI.
- [ ] Aom (FE2) creates mock fixtures with corresponding event-ID inventories so every observed edge and cited finding can be checked against actual synthetic input IDs.
- [ ] Feem (FE1) adds build/test scripts and test setup; Aom (FE2) submits any package needs to Feem (FE1) before dependency installation.
- [ ] If HTTP details remain unresolved, continue explicit mock development and record the integration blocker; do not guess the production schema.

## Your delivery schedule

Elapsed from frontend kickoff; target 5 hours 45 minutes plus 30 minutes contingency. These estimates do not extend the event deadline. Respect the original 15:00 ICT feature freeze and 17:00 ICT submission deadline in `PLANS.md`.

| Elapsed | Your deliverable |
| --- | --- |
| 0:00–0:15 | Agree shared props, graph highlighting and dependency requests. |
| 0:15–1:15 | Scaffold and graph; merge a bootable shell within 40 minutes. |
| 1:15–2:15 | Compose Aom (FE2) exports; complete mock flow and real S02 integration with Aom (FE2). |
| 2:15–3:30 | Stable graph placement, node inspection and uncertainty styling. |
| 3:30–5:45 | Responsive/keyboard/integration verification, review and demo rehearsal. |

### Task A — Feem (FE1): shell and lineage graph

**Files:** Feem (FE1) root setup, app and lineage paths in Your write paths.

**Consumes:** Agreed `Graph` type and component props from Shared interfaces. Until Aom (FE2) fixtures land, use local test inputs within Feem (FE1)-owned test files; do not publish a competing DTO module.

**Produces:** `LineageGraph`, responsive `Workspace`, layout/selection helpers and working development/build/test commands. Proposed helpers: `layoutGraph(graph: Graph)` returns ID-keyed node positions; `getHighlightedEdgeIds(graph: Graph, evidenceEventIds: readonly string[]): string[]` returns edges with intersecting evidence IDs.

- [ ] Scaffold React/TypeScript/Vite and React Flow; configure `npm run dev`, `npm run build`, `npm run test -- --run`. Build includes TypeScript checking. Configure Vitest with jsdom, Testing Library and `src/app/testSetup.ts`; merge a minimal bootable shell before completing graph polish.
- [ ] Write `layout.test.ts` assertions that the same node/edge sets in different input orders produce equal ID-keyed positions. Write `selection.test.ts` assertions that `evt-003` highlights only matching edges and an unknown ID highlights none. Run those tests and record the expected initial failures.
- [ ] Implement deterministic ID-based graph placement and pure evidence intersection. Highlight endpoints of matching edges only; selected nodes never independently imply misconduct.
- [ ] Render solid/dashed labelled edges, external node labels, fit view, visible selection and empty graph message. Add keyboard-accessible node/connected-edge information with `NodeDetails`.
- [ ] Verify focused graph tests and `npm run build`; include actual results in the Feem (FE1) PR.


### Task C — Feem (FE1): workspace composition

**Files:** `src/app/App.tsx`, `Workspace.tsx`, `App.test.tsx`, app styles; lineage selection code if needed.

**Consumes:** Task B hook/client and agreed components; Task A graph and helpers.

**Produces:** One functional mock workspace and integration seam for the API client, without changing feature ownership.

- [ ] Write integration tests for scenario change clearing graph/finding/event/explanation and for selecting a finding highlighting only evidence-matched edges/endpoints. Include a finding with no matching graph edge; its evidence remains inspectable and no unrelated node is highlighted.
- [ ] Compose the mode badge, scenario controls, summary, graph, node details, findings, evidence and explanation. Derive the selected finding from the current response and selected ID; do not store another copy of it.
- [ ] Select `createMockClient()` or `createApiClient(baseUrl)` once from documented environment configuration. Proposed config: `VITE_DATA_MODE=mock|api` and optional `VITE_API_BASE_URL`; these are UI configuration, never secrets. Display the active mode persistently.
- [ ] Implement two columns at ≥1100px, stacked graph/panel below; controls wrap at 390px. Keep a readable textual evidence path without requiring graph pointer use.
- [ ] Verify integration tests and build with the actual Aom (FE2) exports; merge the smallest working mock slice before optional refinements.


## Your completion checklist

- [ ] S02 selected finding highlights only evidence-matched edges and endpoints; a finding with no matching edge highlights nothing unrelated.
- [ ] S02 and S03 yield equivalent graph topology and stable ID-keyed positions; S04 inferred edges remain visibly distinct.
- [ ] Scenario changes remove old graph/selection/explanation through Aom (FE2) hook state; loading and errors render clearly.
- [ ] 1440px/1024px/390px layouts have readable IDs, no clipped controls, at least 16px body text and visible keyboard focus; evidence can be inspected without pointer graph interaction.
- [ ] Combined main builds and passes relevant tests; real S02 API smoke test and 2–3 minute rehearsal pass with Aom (FE2).

## Interaction and state acceptance matrix


| Trigger/state | Required behavior | Owner |
| --- | --- | --- |
| First load | Scenario loading, failure/retry or empty list is visible; Analyze disabled without a valid scenario. | Aom (FE2) state, Feem (FE1) composition |
| Change scenario | Clear analysis/finding/event/explanation; wait for explicit Analyze; discard stale responses. | Aom (FE2) |
| Analyze | Prevent duplicate submission; announce loading/result; render exact server count and status. | Aom (FE2) + Feem (FE1) |
| S01 | No violation observed; compliance disclaimer; approved observed connections; no invented findings. | Both |
| S02 | Verified destination violation; direct evidence IDs; highlight supported transfer/endpoints. | Both |
| S03 | Same result/topology/positions as S02 despite arrival order. | Both |
| S04 | Potential or inconclusive as returned; missing links unverified; no fabricated observed path. | Both |
| Finding selection | Replace evidence, clear old explanation/event; only evidence-matched graph elements highlighted. | Aom (FE2) state, Feem (FE1) graph |
| Node selection | Supplied label/ID/kind and connected-edge evidence, without implying guilt. | Feem (FE1) |
| Evidence selection | Show event ID and associated returned edges/findings; raw payload/timestamp drawer excluded. | Aom (FE2) |
| Empty graph/findings/evidence | Independent understandable empty states; do not infer safety from absence. | Both |
| Failed/attempted transfer | No claim of completed exfiltration; use supplied semantics, no invented edge-outcome field. | Both |
| Explain success | Explanation, next steps, cited IDs; exact AI/fallback label; evidence remains above prose. | Aom (FE2) |
| Explain failure | Preserve valid investigation; retry explanation; no silent synthetic AI response. | Aom (FE2) |
| API failure | Actionable retry; mode stays API; no stale graph relabelled as current. | Aom (FE2) + Feem (FE1) |

## Verification commands and release evidence


Run from the repository root after Feem (FE1) scaffolding exists:

```bash
cd frontend
npm ci
npm run test -- --run
npm run build
npm run dev
```

`npm ci` requires the committed lockfile; Feem (FE1) uses `npm install` during initial setup to create it. The test script must invoke Vitest; `--run` must terminate successfully with all required tests passing. The build must exit 0 with TypeScript and Vite successful. Run `npm ci` for a clean-install check, not on every edit. Browser verification is a separate manual check after the server starts; a passing build alone does not verify interactions or responsive layout.

| Required evidence | Acceptance |
| --- | --- |
| Unit/component/integration checks | Actual test summary and exit codes; no observed edge without supporting fixture IDs; race tests pass. |
| Production build | Exact `npm run build` result on the combined frontend. |
| Real API smoke test | S02 returned IDs match displayed findings/edges; modes and failures remain explicit. |
| Layout/accessibility | Recorded pass/fail for 1440/1024/390 widths and keyboard evidence inspection. |
| Demo/fallback | All four scenarios demonstrated; deterministic explanation fallback demonstrated without fabricated model claims. |

Backend changes, if made by backend owners, retain their existing `go test ./...` and `go vet ./...` release requirements. Frontend developers do not claim those checks passed without actual backend-owner evidence.

## Stop conditions and contingency


1. **Backend contract unresolved:** continue typed mock work; raise exact schema question to BE1/BE2. No guessed HTTP fields, new endpoint or silent contract fork.
2. **P0 integration incomplete:** stop AI/polish work; prioritize real S02 graph/finding/evidence. A mock-only application must be described as mock-only.
3. **Missing evidence misleading:** fix backend classification with BE2; frontend faithfully labels uncertainty and does not turn guesses into observed links. Stop presenting an incorrect scenario as complete.
4. **Ownership/dependency collision:** ask the owning frontend developer for the change; merge their small PR before continuing dependent work. Do not regenerate another owner's package files.
5. **Stable demo reached:** freeze features. Keep advanced UI and deployment work out of the delivery path.

## Handoff to the other developer

Provide the PR link, available exports/props, exact commands and results, known limitations and unresolved contract dependencies. Do not mark API integration complete from mock results. Rehearse S01 → S02 → evidence → S03 → S04 → explanation/fallback together, then freeze features once the demo is stable.

**Planning status:** Documentation only. No application code or frozen contract was changed, and no application tests were run as part of splitting this plan. Original task labels and shared interface proposals are retained from the master plan.
