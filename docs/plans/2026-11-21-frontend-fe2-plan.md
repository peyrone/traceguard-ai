# TraceGuard AI — Aom (FE2) Plan: Investigation, Fixtures and API Client

> Execution handoff: Feem (FE1) and Aom (FE2) implement their own tasks concurrently in one repository, using separate branches/checkouts. Track the checkboxes below. This is a planning deliverable, not authorization to change frozen HTTP contracts or another owner's files.

**Goal:** Deliver one responsive investigation workspace where a synthetic scenario produces an evidence-backed graph, selectable findings, evidence inspection, and an optional explanation with deterministic fallback.

**Architecture:** One React application at `frontend/` inside the existing `traceguard-ai` monorepo. Feem (FE1) owns composition and graph rendering; Aom (FE2) owns typed client, fixtures, request behavior and investigation components. The backend remains the authority for findings and evidence classifications.

**Tech stack:** React, TypeScript, Vite, React Flow (`@xyflow/react`); Vitest, React Testing Library and jsdom for focused tests. No additional router or global state framework for MVP. Feem (FE1) owns dependency changes and the lockfile.

**Baseline:** Read `README.md`, `PLANS.md`, `AGENTS.md`, `docs/00-scope.md`, `docs/02-api-contract.md`, `docs/03-event-schema.md`, `docs/04-team-ownership.md`, `docs/05-scenarios.md`, `docs/09-demo-script.md`, and `prompts/FE2.md` before implementation.

**Visual reference:** https://traceguard-investigation-mockup.ifeemily.chatgpt.site

The published site is a synthetic, browser-local visual prototype. Reimplement the intended experience in React; its scripted interactions, fixture IDs and graph geometry are not the HTTP contract. Match the reference's light technical workspace, evidence hierarchy and responsive structure. Do not transfer its prototype-only preview-state toolbar into the normal application.

## Start here

1. Read this handoff and the baseline documents above. The [master plan](2026-11-21-frontend-master-plan.md) coordinates both developers; this file contains your assigned work.
2. Use branch `codex/fe2-investigation-client` in your own checkout/worktree of the same repository.
3. Agree the proposed interface changes below with the other frontend developer before coding consumers.
4. Execute your tasks in order; keep all work within your write paths.
5. Report exact test/build results and blockers in each small PR; ask the other developer to review.

## Your write paths

- `frontend/src/features/investigation/`: `ScenarioSelector.tsx`, `AnalysisSummary.tsx`, `InvestigationPanel.tsx`, `FindingList.tsx`, `EvidenceDetails.tsx`, `ExplanationPanel.tsx`, `useInvestigation.ts`, `investigation.css`, colocated `*.test.tsx`/`*.test.ts`.
- `frontend/src/lib/api/`: `types.ts`, `client.ts`, `client.test.ts`.
- `frontend/src/lib/fixtures/`: `scenarios.ts`, `analysis.ts`, `explanations.ts`, `fixtures.test.ts`.

Feem (FE1) owns frontend root configuration, package/lockfile, `frontend/src/app/` and `frontend/src/features/lineage/`. Do not edit them. Request dependencies/test configuration from Feem (FE1). Backend files and generated handlers remain outside your scope.

Start typed fixtures and components immediately; update from main after Feem (FE1) merges the scaffold to run tests/builds. Export components, clients and hook for Feem (FE1) composition. Feem (FE1) handles graph highlighting and app wiring; supply finding event IDs and agree the prop extensions below. Coordinate unresolved scenario/explain schemas with BE1/BE2 before API integration.

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
| 0:00–0:15 | Agree props; confirm DTO and scenario/explanation schema dependencies. |
| 0:15–1:15 | Fixtures, investigation panels and hook; request packages from Feem (FE1). |
| 1:15–2:15 | Typed API client, request recovery and real S02 integration with Feem (FE1). |
| 2:15–3:30 | S01/S03/S04 gaps and explanation/fallback behavior. |
| 3:30–5:45 | Client/race/error tests, accessibility fixes, review and demo rehearsal. |

### Task B — Aom (FE2): fixture-driven investigation

**Files:** Aom (FE2) fixtures, investigation components/styles and colocated tests in Your write paths.

**Consumes:** Frozen status/evidence semantics and agreed UI interfaces.

**Produces:** Exported scenario/finding/evidence/explanation components, `createMockClient(): InvestigationClient`, `useInvestigation(client: InvestigationClient)` and deterministic S01–S04 fixtures.

The hook exposes scenario-list state, selected scenario ID, analysis state, selected finding ID, selected event ID and explanation state. Its actions are `selectScenario(id)`, `analyze()`, `selectFinding(id)`, `selectEvidence(id)`, `explain()` and `retryScenarios()`. Keep state ownership here; Feem (FE1) composition consumes these exports rather than keeping a second copy of request state. Define discriminated idle/loading/success/error states; keep analysis and explanation errors independent.

- [ ] Write fixture tests proving every observed edge has nonempty supporting IDs present in that scenario's input event inventory, S02/S03 have equal event sets and analysis results, and S04 has no fabricated observed intermediate edge.
- [ ] Build S01 allowed, S02 verified, S03 shuffled and S04 potential/inconclusive fixtures. Add empty/no-evidence, attempted/failed and explanation fallback cases in test fixtures; they do not require extra production scenario endpoints.
- [ ] Write component tests for all four exact status labels, no-compliance disclaimer, selected finding/evidence details and explicit evidence gaps. Confirm failures before implementation.
- [ ] Implement components with evidence above explanation, monospace IDs, supplied messages/rule IDs, meaningful no-findings/no-evidence states and scoped styles. Render only available edge associations for a selected event ID.
- [ ] Verify fixture/panel tests and build after scaffold merges. Deliver named exports and a short integration example to Feem (FE1); do not edit app composition.


### Task D — Aom (FE2): API integration, request safety and explanations

**Files:** `src/lib/api/client.ts`, `client.test.ts`, `types.ts`; `useInvestigation.ts` and tests; `ExplanationPanel.tsx` and tests.

**Consumes:** Confirmed OpenAPI schemas, Task B components and state model.

**Produces:** `createApiClient(baseUrl: string): InvestigationClient`, contract-aligned requests and safe asynchronous behavior. Mock and API clients implement the same interface; no automatic mode switching.

- [ ] Write client tests for confirmed request methods/paths/bodies, successful responses, non-2xx `{code,message}` errors and malformed responses. Write hook tests using controllable promises: delayed scenario A cannot overwrite B, delayed finding A explanation cannot overwrite B, unmount cancels/ignores pending work, repeated Analyze is prevented.
- [ ] Implement fetch with AbortSignal plus request identity checks. Scenario changes clear analysis, finding, evidence and explanation immediately. Finding changes clear explanation and selected evidence. Reanalysis clears obsolete selections/explanation; aborted requests do not show misleading failure alerts.
- [ ] Implement scenario-list loading/error/empty/retry, analyze loading/error/retry and explicit idle state. Do not retain an old graph as though it belongs to a new scenario or failed request.
- [ ] Add explain tests and UI for loading, `mode: ai`, `mode: fallback`, next steps, actual cited IDs and error/retry. Keep evidence usable on failure. Reject/flag unknown cited IDs as unvalidated response data instead of presenting them as verified proof. Client never stores an OpenAI API key.
- [ ] Verify relevant tests and build. Coordinate one real API smoke test with BE1: S02 request renders returned graph/finding/event IDs; record any schema mismatch without modifying frozen documents.


## Your completion checklist

- [ ] Every observed fixture edge and finding references real synthetic input event IDs; S02/S03 share the same events/results; S04 invents no observed link.
- [ ] Scenario/finding changes reset obsolete evidence/explanation; delayed requests cannot overwrite the active investigation; repeated Analyze is prevented.
- [ ] Scenario-list loading/error/empty/retry, analysis loading/error/empty/retry and independent explanation errors work without silent mock substitution.
- [ ] AI/fallback labels reflect returned mode; evidence stays usable on explanation failure; unknown cited IDs are flagged; attempted/failed transfers are never completed exfiltration.
- [ ] Combined main builds and passes relevant tests; keyboard evidence inspection, real S02 API smoke test and 2–3 minute rehearsal pass with Feem (FE1).

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
