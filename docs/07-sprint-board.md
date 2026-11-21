# GitHub Issues — Create These Before Build Day

**Planning issues** may be created before competition. New application code is implemented during the official window. Each issue should have a clear owner, dependency, test/evidence and acceptance check.

| ID | Priority | Owner | Issue title | Dependency | Done when |
|---|---|---|---|---|---|
| TG-01 | P0 | Team | Lock API/event/graph/props contract | — | All 4 approve; no schema ambiguity |
| TG-02 | P0 | FE1 | Scaffold public React/Vite app and layout | TG-01 | `npm run build` passes; importable shell |
| TG-03 | P0 | BE1 | Scaffold public Go/Echo server, OpenAPI generator | TG-01 | server boots + healthz + codegen runs |
| TG-04 | P0 | FE2 | Scenario picker + Findings/Evidence components with mock data | TG-01 | Components render in isolation without backend |
| TG-05 | P0 | BE2 | Pure privacy policy evaluator + table tests | TG-01 | tests pass for allowed/denied/attempt |
| TG-06 | P0 | BE1 | Correlate events + construct evidence graph | TG-03 | graph has source IDs, stable order |
| TG-07 | P0 | FE1 | Render data lineage graph | TG-02 | observed/inferred distinction + selection |
| TG-08 | P0 | BE1 | `POST /analyze` composes lineage + detection | TG-05,TG-06 | real scenario yields verified finding |
| TG-09 | P0 | FE2 | Typed API client and investigation integration | TG-03,TG-04 | dashboard calls real backend |
| TG-10 | P0 | FE1 | Wire app shell graph + investigation feature | TG-07,TG-09 | single-screen end-to-end |
| TG-11 | P1 | BE1 | Out-of-order / duplicate invariants | TG-06 | deterministic shuffle tests |
| TG-12 | P1 | BE2 | Missing-evidence classification and tests | TG-05,TG-06 | potential/inconclusive, no fake evidence |
| TG-13 | P1 | BE2 | AI explanation with deterministic fallback | TG-05 | works with/without API key |
| TG-14 | P1 | FE2 | Explanation panel/error and loading states | TG-09,TG-13 | no blank screen on AI timeout |
| TG-15 | P0 | Team | End-to-end scenario smoke tests | TG-08,TG-10 | S01–S04 behavior matches docs |
| TG-16 | P0 | Team | Demo script, clean checkout and submission | TG-15 | clean start + judges can follow README |

## Release gating
- Before 10:40: TG-02/TG-03 minimal scaffold merged.
- Before 12:30: TG-08/TG-10 done; a real end-to-end run demonstrated.
- Before 15:00: P1 done or explicitly deferred.
- By 16:45: TG-16 ready and submitting.

## FE1 execution — `feat/fe-framework-graph`

| Task | Status | Evidence / next gate |
|---|---|---|
| Runbook review / branch | Done | Read `/Users/feem/Documents/hackathonOpenAI/TRACEGUARD_CODEX_4_PERSON_RUNBOOK.md` after user supplied location; matches repo runbook. New branch created from clean main at `f8a502c`. |
| TG-02 scaffold | Build / HTTP boot verified | Existing React/Vite scaffold retained; `npm run build` exits 0. Vite serves HTML at `http://127.0.0.1:5173/`. |
| TG-07 lineage | Implemented; visual verification pending | Stable topology-based columns and ID-sorted rows, observed/inferred labels, external labels, evidence-matched highlighting, keyboard service details. Graph/client tests: 6 passed, 0 failed. |
| TG-10 composition | Automated checks passed; FE2 evidence integration pending | Automatic analysis retained per revised FE1 handoff; explicit API identity, no automatic mock substitution, compliance disclaimer, responsive layout. Four component tests pass, including stale-response rejection and scenario reset. |
| TG-15 smoke / handoff | Blocked for real API / browser | Production build and 10 tests pass. Browser host unavailable; `go run ./cmd/traceguard-api` cannot start because Go is absent from PATH. S01–S04 and 1440/1024/390 visual checks remain unverified. |

### Dependencies and decisions

- User confirmed FE2 agreement in this session for optional `highlightedEdgeIds: string[]` on `LineageGraph`; original props retained. Composition derives matching edge IDs from selected finding evidence. No HTTP/event contract change.
- FE2's planned `useInvestigation` / mock-client exports are absent. Preserve current client and panel interfaces; do not edit their owned files or create competing shared DTOs.
- `rtk` is not installed. Homebrew Node fails due to missing `libsimdjson.33.dylib`; use existing NVM Node v24.16.0 for verification.
- Ruling: retain existing Node tests for FE2 compatibility; add Vitest/jsdom component tests separately. `npm run test -- --run` runs both suites.
- Verification: NVM Node v24.16.0; `npm test` (frontend) exits 0, 5/5 tests. Initial layout/external-label tests failed, then passed. Highlight test initially failed because helper was absent, then passed. `npm run build` exits 0; Vite warns about upstream `react-compiler-runtime` “use no memo” directive.
- Concurrent changes appeared in `docs/plans/` after execution began; these were not authored by this FE1 session and are left untouched.
- Revised FE1 plan now requires preserving automatic analysis; implementation and tests were aligned to that revision. Earlier explicit Analyze work was superseded.
- `npm install -D vitest jsdom @testing-library/react @testing-library/user-event --fetch-retries=0 --fetch-timeout=15000`: 64 packages added, 112 audited, 0 vulnerabilities (exit 0). Original sandboxed install stalled; approved network install succeeded.
- Current verification: `npm run test -- --run` exits 0 (6 Node tests + 4 Vitest tests); `npm run build` exits 0; `git diff --check` exits 0. Component checks cover evidence mapping including unmatched IDs, keyboard service selection, scenario resets, fallback rendering, API-error recovery and stale analysis exclusion.
- No FE2/backend source files or frozen HTTP/event contracts edited. FE2 evidence-event selection export remains a dependency; current panel renders cited IDs as text.
- Clean install: `npm ci --ignore-scripts --no-audit --no-fund` exits 0, 111 packages installed. Post-install tests/build rerun before handoff. Local Vite serves the HTML entry and transformed App module; this is an HTTP boot check, not visual browser verification.
- Automatic graph preview after API failure was removed so an API error cannot replace results with synthetic graph data. API mode stays visible through errors. No standalone mock adapter was added in FE2-owned paths.

### Final review and handoff

- Independent review identified an unrelated service obscuring an evidence edge in the alphabetical one-row layout. Added a regression test (failed first), then deterministic topology columns / separate rows; all 10 tests and production build pass after the fix. Cyclic remainder uses separate rows without inventing causal ordering.
- Runtime requirement now matches the locked jsdom dependency: `^22.22.2 || ^24.15.0 || >=26.0.0`; verified using Node v24.16.0. Package manifest and lockfile agree.
- Final `npm run test -- --run`: exit 0, 6 Node tests + 4 Vitest component tests. Final `npm run build`: exit 0, upstream directive warning remains. Final `git diff --check`: exit 0.
- Changes remain local on `feat/fe-framework-graph`; not committed, pushed or merged. Review only FE1-owned frontend paths and this board; exclude concurrent `docs/plans/` edits from the FE1 PR.
- Next integration gate: FE2 supplies evidence-event inspection exports; BE1 supplies a runnable API for real S01–S04 checks. Browser access is required for responsive visual acceptance.

## FE1 + FE2 merge checkpoints

- FE1 committed as `e573b12`; merged `origin/feat/fe-investigation` (`8add912`) into `feat/fe-framework-graph` without conflicts.
- Integration and every individual test task are tracked in [fe-integration-test-checkpoints.md](fe-integration-test-checkpoints.md). Combined verification is in progress; previous results above describe the pre-merge FE1 slice.
- Merge commit: `bcbbcd7`. App now passes graph data into FE2's evidence panel and accepts an injected client for deterministic integration checks. FE2 source files remain unchanged after the merge.
- Combined verification: clean install exits 0 (111 packages); 12 Node tests + 4 component tests pass; TypeScript/Vite build and whitespace check exit 0. Checkpoint runner records every test name/result and command in the linked file; `npm run test:checkpoints` reruns and updates it automatically.
- TG-10 evidence-panel composition is integrated and automated checks pass. TG-15 remains blocked for live API S01–S04 (Go / running API unavailable) and visual viewport checks (browser host unavailable). Those tasks are explicitly BLOCKED in checkpoints, not counted as passes.
- FE1 commit and FE2 merge are local on `feat/fe-framework-graph`; no push or merge to main performed. Concurrent `docs/plans/` edits are excluded from these commits.
