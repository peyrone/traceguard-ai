# FE1 + FE2 integration test checkpoints

Update this file for **every test task**: mark RUNNING before execution, then PASS, FAIL or BLOCKED immediately after reviewing output. Record the exact command, exit code, test count, and follow-up. Never mark browser/API checks passed from fixture tests.

Branch: `feat/fe-framework-graph`
FE1 commit: `e573b12`
FE2 source: `origin/feat/fe-investigation` at `8add912`
Runtime: NVM Node v24.16.0 (`PATH=/Users/feem/.nvm/versions/node/v24.16.0/bin:$PATH`).

| Checkpoint | Test task | Status | Evidence / next action |
|---|---|---|---|
| CP-01 | FE1 pre-commit regression / build | PASS | `cd frontend && npm run test -- --run`: exit 0, 6 Node + 4 component tests. `npm run build`: exit 0; upstream “use no memo” warning. |
| CP-02 | Merged Node suites: graph, HTTP client, fixtures and FE2 panels | PASS | 12 Node tests passed; all FE2 test paths included. |
| CP-03 | App composition: evidence, highlighting, scenario reset, fallback and stale-response rejection | PASS | 4 component tests passed after adapting client construction; graph supplied to EvidencePanel. |
| CP-04 | Combined production build / whitespace / lockfile | PASS | Clean install, TypeScript/Vite build and whitespace check passed; post-install 16 tests passed. |
| CP-05 | Real API S01–S04 and explanation fallback | BLOCKED | Check available Go runtime / API. Record blocker if unavailable. |
| CP-06 | Browser 1440 / 1024 / 390 and keyboard evidence inspection | BLOCKED | Check browser access. Record each width and keyboard result individually. |

## Execution log

- CP-01: Passed before FE1 commit; FE2 merge completed without conflicts. Concurrent `docs/plans/` edits remain uncommitted and outside this integration change.

- CP-02 attempt 1: `npm run test:unit` from repository root exited 1 (missing script); no tests executed. Correcting working directory to `frontend/`; CP-02 remains RUNNING.

- CP-02 attempt 2: `cd frontend && npm run test:unit`: exit 0, 12 passed, 0 failed. Includes FE2 panel, request/error/citation, mock scenario, fixture integrity and graph tests.

- CP-03 attempt 1: `cd frontend && npx vitest run`: exit 1, 4 failed. FE2 client captures fetch at construction, so old global-fetch stubs no longer intercept App requests. Add App client injection; construct test clients after stubbing fetch. Also supply graph to the new EvidencePanel through InvestigationPanel.

Run all automated checkpoints with `cd frontend && npm run test:checkpoints`. The runner marks each task RUNNING, records all individual test results, writes PASS/FAIL, and stops on failure.

## Automated run 2026-11-21T04:51:28.960Z

Runtime: v24.16.0. Each task updates this file before and after execution. Test output below records each individual test result.

### CP-02: Merged Node suites — RUNNING

Command from frontend: `npm run test:unit`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 test:unit
> node --test src/features/lineage/*.test.ts src/features/investigation/*.test.ts src/lib/api/*.test.ts src/lib/fixtures/*.test.ts

✔ the standalone panels expose the referenced events and analysis states (79.325042ms)
✔ allowed-flow evidence does not pass through an unrelated external service (0.479292ms)
✔ finding evidence highlights only matching edges and their endpoints (0.3545ms)
✔ node positions remain stable after input order changes, including cyclic and isolated services (0.396375ms)
✔ external services carry an explicit text label (0.107584ms)
✔ observed and inferred links keep distinct labels and cite only supplied events (0.109292ms)
✔ joins hosted and local URLs with each API endpoint (0.380541ms)
✔ the HTTP client follows the OpenAPI paths and exact request bodies (14.58525ms)
✔ the HTTP client handles API errors and rejects unknown evidence citations (0.797792ms)
✔ mock mode analyzes named scenarios and explains using the supplied finding evidence (0.418041ms)
✔ shuffled events preserve analysis without sharing input order (0.976875ms)
✔ fixture findings and edges reference input events and keep inferred links distinct (0.380458ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 303.292667

```

### CP-03: App component integration — RUNNING

Command from frontend: `npm exec -- vitest run`

Result: **PASS**, exit 0.

```text

 RUN  v5.1.1 /Users/feem/Documents/hackathonOpenAI/traceguard-ai/frontend


 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  11:51:29
   Duration  685ms (environment 56%, tests 20%, import 19%, transform 5%)


```

### CP-04: Production build — RUNNING

Command from frontend: `npm run build`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 48 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip:   0.27 kB
dist/assets/index-C7Y-EtX8.css   20.42 kB │ gzip:   4.04 kB
dist/assets/index-Da-YbzLE.js   482.08 kB │ gzip: 158.13 kB

✓ built in 96ms
[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use no memo" in "node_modules/react-compiler-runtime/dist/index.js" may not be preserved when bundling.
    ╭─[ node_modules/react-compiler-runtime/dist/index.js:14:1 ]
    │
 14 │ "use no memo";
    │ ───────┬──────
    │        ╰──────── module level directive may not be preserved
    │
    │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
────╯


```

### CP-04: Whitespace verification — RUNNING

Command from frontend: `git diff --check`

Result: **PASS**, exit 0.

```text

```

- CP-05: `command -v go` found no executable; `/usr/local/go/bin/go` and `/opt/homebrew/bin/go` do not exist. `curl -s --max-time 3 http://localhost:8080/healthz` exited 7 (connection failed). Real S01, S02, S03, S04 and server explanation fallback are individually BLOCKED until BE1 provides a running API. Fixture checks do not satisfy this checkpoint.
- CP-06: checking browser access before attempting individual viewport and keyboard tasks.

- CP-06: `cua.getState()` reports no enabled browsers and “The browser access host is unavailable.” Viewport tasks 1440px, 1024px, 390px and rendered keyboard evidence inspection are each BLOCKED. jsdom keyboard service selection is covered by CP-03 but does not prove rendered layout.

## Automated run 2026-11-21T04:52:13.180Z

Runtime: v24.16.0. Each task updates this file before and after execution. Test output below records each individual test result.

### CP-04: Clean dependency install — RUNNING

Command from frontend: `npm ci --ignore-scripts --no-audit --no-fund`

Result: **PASS**, exit 0.

```text

added 111 packages in 2s

```

### CP-02: Merged Node suites — RUNNING

Command from frontend: `npm run test:unit`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 test:unit
> node --test src/features/lineage/*.test.ts src/features/investigation/*.test.ts src/lib/api/*.test.ts src/lib/fixtures/*.test.ts

✔ the standalone panels expose the referenced events and analysis states (112.834167ms)
✔ allowed-flow evidence does not pass through an unrelated external service (1.220833ms)
✔ finding evidence highlights only matching edges and their endpoints (0.913541ms)
✔ node positions remain stable after input order changes, including cyclic and isolated services (0.444542ms)
✔ external services carry an explicit text label (0.199ms)
✔ observed and inferred links keep distinct labels and cite only supplied events (0.24775ms)
✔ joins hosted and local URLs with each API endpoint (0.370958ms)
✔ the HTTP client follows the OpenAPI paths and exact request bodies (18.4205ms)
✔ the HTTP client handles API errors and rejects unknown evidence citations (1.157625ms)
✔ mock mode analyzes named scenarios and explains using the supplied finding evidence (0.646083ms)
✔ shuffled events preserve analysis without sharing input order (0.59025ms)
✔ fixture findings and edges reference input events and keep inferred links distinct (0.162792ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 988.460792

```

### CP-03: App component integration — RUNNING

Command from frontend: `npm exec -- vitest run --reporter=verbose`

Result: **PASS**, exit 0.

```text

 RUN  v5.1.1 /Users/feem/Documents/hackathonOpenAI/traceguard-ai/frontend

 ✓ src/app/App.test.tsx > automatic analysis drives highlights and evidence remains inspectable without matching edges 65ms
 ✓ src/app/App.test.tsx > scenario changes clear service selection and explanation before automatic analysis 37ms
 ✓ src/app/App.test.tsx > API failures stay visible without substituting a preview graph; retry recovers 10ms
 ✓ src/app/App.test.tsx > late analysis from the previous scenario cannot replace current results 14ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  11:52:16
   Duration  502ms (environment 44%, tests 29%, import 15%, transform 11%)


```

### CP-04: Production build — RUNNING

Command from frontend: `npm run build`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 48 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip:   0.27 kB
dist/assets/index-C7Y-EtX8.css   20.42 kB │ gzip:   4.04 kB
dist/assets/index-Da-YbzLE.js   482.08 kB │ gzip: 158.13 kB

✓ built in 438ms
[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use no memo" in "node_modules/react-compiler-runtime/dist/index.js" may not be preserved when bundling.
    ╭─[ node_modules/react-compiler-runtime/dist/index.js:14:1 ]
    │
 14 │ "use no memo";
    │ ───────┬──────
    │        ╰──────── module level directive may not be preserved
    │
    │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
────╯


```

### CP-04: Whitespace verification — RUNNING

Command from frontend: `git diff --check`

Result: **PASS**, exit 0.

```text

```

- Runner usage: `cd frontend && npm run test:checkpoints` for routine checks; append `-- --clean` to include a clean dependency install. Latest component assertions also check related evidence edges appear for the selected finding and disappear for unmatched evidence.

## Automated run 2026-11-21T04:52:39.481Z

Runtime: v24.16.0. Each task updates this file before and after execution. Test output below records each individual test result.

### CP-02: Merged Node suites — RUNNING

Command from frontend: `npm run test:unit`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 test:unit
> node --test src/features/lineage/*.test.ts src/features/investigation/*.test.ts src/lib/api/*.test.ts src/lib/fixtures/*.test.ts

✔ the standalone panels expose the referenced events and analysis states (102.839167ms)
✔ allowed-flow evidence does not pass through an unrelated external service (0.511583ms)
✔ finding evidence highlights only matching edges and their endpoints (0.406625ms)
✔ node positions remain stable after input order changes, including cyclic and isolated services (0.533416ms)
✔ external services carry an explicit text label (0.264208ms)
✔ observed and inferred links keep distinct labels and cite only supplied events (0.174458ms)
✔ joins hosted and local URLs with each API endpoint (0.577459ms)
✔ the HTTP client follows the OpenAPI paths and exact request bodies (23.063416ms)
✔ the HTTP client handles API errors and rejects unknown evidence citations (0.373417ms)
✔ mock mode analyzes named scenarios and explains using the supplied finding evidence (0.204625ms)
✔ shuffled events preserve analysis without sharing input order (0.828292ms)
✔ fixture findings and edges reference input events and keep inferred links distinct (0.163625ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 400.006667

```

### CP-03: App component integration — RUNNING

Command from frontend: `npm exec -- vitest run --reporter=verbose`

Result: **PASS**, exit 0.

```text

 RUN  v5.1.1 /Users/feem/Documents/hackathonOpenAI/traceguard-ai/frontend

 ✓ src/app/App.test.tsx > automatic analysis drives highlights and evidence remains inspectable without matching edges 71ms
 ✓ src/app/App.test.tsx > scenario changes clear service selection and explanation before automatic analysis 36ms
 ✓ src/app/App.test.tsx > API failures stay visible without substituting a preview graph; retry recovers 9ms
 ✓ src/app/App.test.tsx > late analysis from the previous scenario cannot replace current results 14ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  11:52:40
   Duration  696ms (environment 59%, tests 21%, import 16%, transform 4%)


```

### CP-04: Production build — RUNNING

Command from frontend: `npm run build`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 48 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip:   0.27 kB
dist/assets/index-C7Y-EtX8.css   20.42 kB │ gzip:   4.04 kB
dist/assets/index-Da-YbzLE.js   482.08 kB │ gzip: 158.13 kB

✓ built in 114ms
[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use no memo" in "node_modules/react-compiler-runtime/dist/index.js" may not be preserved when bundling.
    ╭─[ node_modules/react-compiler-runtime/dist/index.js:14:1 ]
    │
 14 │ "use no memo";
    │ ───────┬──────
    │        ╰──────── module level directive may not be preserved
    │
    │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
────╯


```

### CP-04: Whitespace verification — RUNNING

Command from frontend: `git diff --check`

Result: **PASS**, exit 0.

```text

```

- CP-04 staged-file check found trailing spaces in Markdown line breaks and captured upstream warning output. The earlier working-tree check did not include the untracked checkpoint file. Removed trailing spaces and updated the runner to normalize captured output before recording it. Re-running automated checkpoints to verify the correction.

## Automated run 2026-11-21T04:53:19.866Z

Runtime: v24.16.0. Each task updates this file before and after execution. Test output below records each individual test result.

### CP-02: Merged Node suites — RUNNING

Command from frontend: `npm run test:unit`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 test:unit
> node --test src/features/lineage/*.test.ts src/features/investigation/*.test.ts src/lib/api/*.test.ts src/lib/fixtures/*.test.ts

✔ the standalone panels expose the referenced events and analysis states (85.701541ms)
✔ allowed-flow evidence does not pass through an unrelated external service (0.754625ms)
✔ finding evidence highlights only matching edges and their endpoints (0.476542ms)
✔ node positions remain stable after input order changes, including cyclic and isolated services (0.294834ms)
✔ external services carry an explicit text label (0.106875ms)
✔ observed and inferred links keep distinct labels and cite only supplied events (0.11275ms)
✔ joins hosted and local URLs with each API endpoint (0.353625ms)
✔ the HTTP client follows the OpenAPI paths and exact request bodies (30.725791ms)
✔ the HTTP client handles API errors and rejects unknown evidence citations (1.070208ms)
✔ mock mode analyzes named scenarios and explains using the supplied finding evidence (0.4675ms)
✔ shuffled events preserve analysis without sharing input order (1.359583ms)
✔ fixture findings and edges reference input events and keep inferred links distinct (0.308583ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 342.404375

```

### CP-03: App component integration — RUNNING

Command from frontend: `npm exec -- vitest run --reporter=verbose`

Result: **PASS**, exit 0.

```text

 RUN  v5.1.1 /Users/feem/Documents/hackathonOpenAI/traceguard-ai/frontend

 ✓ src/app/App.test.tsx > automatic analysis drives highlights and evidence remains inspectable without matching edges 68ms
 ✓ src/app/App.test.tsx > scenario changes clear service selection and explanation before automatic analysis 36ms
 ✓ src/app/App.test.tsx > API failures stay visible without substituting a preview graph; retry recovers 10ms
 ✓ src/app/App.test.tsx > late analysis from the previous scenario cannot replace current results 13ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  11:53:20
   Duration  671ms (environment 58%, tests 21%, import 19%, transform 3%)


```

### CP-04: Production build — RUNNING

Command from frontend: `npm run build`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 48 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip:   0.27 kB
dist/assets/index-C7Y-EtX8.css   20.42 kB │ gzip:   4.04 kB
dist/assets/index-Da-YbzLE.js   482.08 kB │ gzip: 158.13 kB

✓ built in 100ms
[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use no memo" in "node_modules/react-compiler-runtime/dist/index.js" may not be preserved when bundling.
    ╭─[ node_modules/react-compiler-runtime/dist/index.js:14:1 ]
    │
 14 │ "use no memo";
    │ ───────┬──────
    │        ╰──────── module level directive may not be preserved
    │
    │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
────╯


```

### CP-04: Whitespace verification — RUNNING

Command from frontend: `git diff --check`

Result: **PASS**, exit 0.

```text

```

## CP-07: Local browser boot — PASS (API unavailable)

- Requested by user: run frontend in browser. Vite restarted on `http://127.0.0.1:5173/` using NVM Node v24.16.0.
- Dedicated browser host remains unavailable; native Chrome control succeeded. Verified visible heading “TraceGuard AI”, “Synthetic audit data · API mode”, scenario control and “Retry scenarios”.
- Page shows “Unable to load scenarios. Failed to fetch” because the backend is unavailable. Frontend boot passes; live scenarios remain BLOCKED. This does not verify the 1440/1024/390 graph layouts.

## Automated run 2026-11-21T05:00:11.142Z

Runtime: v24.16.0. Each task updates this file before and after execution. Test output below records each individual test result.

### CP-02: Merged Node suites — RUNNING

Command from frontend: `npm run test:unit`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 test:unit
> node --test src/features/lineage/*.test.ts src/features/investigation/*.test.ts src/lib/api/*.test.ts src/lib/fixtures/*.test.ts

12:00:11 PM [vite] (client) Re-optimizing dependencies because vite config has changed
✔ the standalone panels expose the referenced events and analysis states (105.752416ms)
✔ allowed-flow evidence does not pass through an unrelated external service (0.52225ms)
✔ finding evidence highlights only matching edges and their endpoints (0.900458ms)
✔ node positions remain stable after input order changes, including cyclic and isolated services (0.241333ms)
✔ external services carry an explicit text label (0.104917ms)
✔ observed and inferred links keep distinct labels and cite only supplied events (0.195875ms)
✔ joins hosted and local URLs with each API endpoint (0.607959ms)
✔ the HTTP client follows the OpenAPI paths and exact request bodies (25.345333ms)
✔ the HTTP client handles API errors and rejects unknown evidence citations (0.432458ms)
✔ mock mode analyzes named scenarios and explains using the supplied finding evidence (0.664292ms)
✔ shuffled events preserve analysis without sharing input order (0.866166ms)
✔ fixture findings and edges reference input events and keep inferred links distinct (0.147916ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 377.004375

```

### CP-03: App component integration — RUNNING

Command from frontend: `npm exec -- vitest run --reporter=verbose`

Result: **PASS**, exit 0.

```text

 RUN  v5.1.1 /Users/feem/Documents/hackathonOpenAI/traceguard-ai/frontend

 ✓ src/app/App.test.tsx > automatic analysis drives highlights and evidence remains inspectable without matching edges 65ms
 ✓ src/app/App.test.tsx > scenario changes clear service selection and explanation before automatic analysis 35ms
 ✓ src/app/App.test.tsx > API failures stay visible without substituting a preview graph; retry recovers 9ms
 ✓ src/app/App.test.tsx > late analysis from the previous scenario cannot replace current results 14ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  12:00:12
   Duration  742ms (environment 63%, tests 18%, import 17%, transform 2%)


```

### CP-04: Production build — RUNNING

Command from frontend: `npm run build`

Result: **PASS**, exit 0.

```text

> traceguard-ai-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 48 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip:   0.27 kB
dist/assets/index-C7Y-EtX8.css   20.42 kB │ gzip:   4.04 kB
dist/assets/index-Da-YbzLE.js   482.08 kB │ gzip: 158.13 kB

✓ built in 106ms
[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use no memo" in "node_modules/react-compiler-runtime/dist/index.js" may not be preserved when bundling.
    ╭─[ node_modules/react-compiler-runtime/dist/index.js:14:1 ]
    │
 14 │ "use no memo";
    │ ───────┬──────
    │        ╰──────── module level directive may not be preserved
    │
    │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
────╯


```

### CP-04: Whitespace verification — RUNNING

Command from frontend: `git diff --check`

Result: **PASS**, exit 0.

```text

```
