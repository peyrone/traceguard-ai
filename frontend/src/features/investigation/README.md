# Investigation integration

The dashboard uses the configured `api` client and passes explanation state through `InvestigationPanel` props. For an isolated render, pass a client-backed `requestExplanation` callback as shown below.

The selector and investigation panel accept typed props. Call `client.listScenarios(signal)` to populate the selector and `client.analyze({ scenario_id: id }, signal)` on change. Pass the response graph to both the lineage view and the investigation panel. Clear the selected finding when the scenario changes.

```tsx
import { InvestigationPanel, ScenarioSelector } from "../features/investigation/index.ts";
import { createTraceGuardClient } from "../lib/api/client.ts";
import { createExplainRequest } from "../lib/api/explanation.ts";

const client = createTraceGuardClient();

// Inside the app component, with state and handlers supplied by FE1.
return (
  <>
    <ScenarioSelector
      scenarios={scenarios}
      selectedScenarioId={scenarioId}
      onChange={loadScenario}
      state={scenarioState}
    />

    <InvestigationPanel
      findings={analysis?.findings ?? []}
      graph={analysis?.graph}
      selectedFindingId={selectedFindingId}
      onSelectFinding={setSelectedFindingId}
      state={analysisState}
      requestExplanation={(finding, signal) =>
        client.explain(createExplainRequest({
          finding,
          ruleSummary: "Transfers of classified data require an approved destination and purpose.",
        }), signal)
      }
    />
  </>
);
```

Use `createMockTraceGuardClient()` from `../lib/api/mock.ts` for the same calls with deterministic local scenarios. To render without client calls, import `mockScenarios` and `scenarioFixtures` from `../lib/fixtures/scenarios.ts` and pass a fixture's `analysis.findings` and `analysis.graph` directly. In live mode, the default client expects same-origin API routes. For a separate API origin, pass `baseUrl` to the client and configure the browser-facing proxy or CORS in the host environment.

Run the feature tests from the FE1 scaffold's `frontend/` directory.

```sh
node --test src/features/investigation/panels.test.ts src/lib/api/client.test.ts src/lib/fixtures/scenarios.test.ts
```
