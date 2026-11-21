import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import type { ExplainResponse } from "../../lib/api/types.ts";
import { mockScenarios, scenarioFixtures } from "../../lib/fixtures/scenarios.ts";

test("the standalone panels expose the referenced events and analysis states", async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, watch: null, ws: false },
  });
  try {
    const { InvestigationPanel, ScenarioSelector } = await server.ssrLoadModule(
      "/src/features/investigation/index.ts",
    ) as typeof import("./index.ts");

    const { graph, findings } = scenarioFixtures.missing_intermediate.analysis;
    const onSelectFinding = () => {};
    const render = (state?: Parameters<typeof InvestigationPanel>[0]["state"]) =>
      renderToStaticMarkup(createElement(InvestigationPanel, {
        findings,
        graph,
        selectedFindingId: findings[0].id,
        onSelectFinding,
        requestExplanation: async (): Promise<ExplainResponse> => ({
          explanation: "Potential violation.",
          next_steps: [],
          evidence_event_ids: ["evt-004"],
          mode: "fallback",
        }),
        state,
      }));

    const { FindingStatus } = await server.ssrLoadModule("/src/features/investigation/FindingStatus.tsx") as typeof import("./FindingStatus.tsx");
    for (const status of ["VERIFIED_VIOLATION", "POTENTIAL_VIOLATION", "INCONCLUSIVE", "NO_VIOLATION_OBSERVED"] as const) {
      const label = renderToStaticMarkup(createElement(FindingStatus, { status }));
      assert.equal(label.includes('class="finding-issue-icon"'), status.endsWith("_VIOLATION"), status);
    }
    const markup = render();
    assert.match(markup, /Potential violation/);
    assert.match(markup, /evt-004/);
    assert.match(markup, /Inferred link/);
    assert.match(markup, /Explain finding/);
    assert.doesNotMatch(markup, /Observed transfer/);
    assert.match(markup, /Completed send event linking Sales API to External CRM/);
    assert.match(render({ status: "loading" }), /Analyzing scenario/);
    assert.match(render({ status: "error", message: "Analysis unavailable" }), /Analysis unavailable/);
    const controlledMarkup = renderToStaticMarkup(createElement(InvestigationPanel, {
      findings,
      selectedFindingId: findings[0].id,
      onSelectFinding,
      onExplain: () => {},
      explaining: false,
      explanationError: null,
      explanation: {
        explanation: "Potential violation.",
        next_steps: ["Collect the missing send event."],
        evidence_event_ids: ["evt-004"],
        mode: "fallback",
      },
    }));
    assert.match(controlledMarkup, /Rule-based fallback/);
    assert.match(controlledMarkup, /Collect the missing send event/);
    assert.match(controlledMarkup, /evt-004/);
    assert.match(renderToStaticMarkup(createElement(InvestigationPanel, {
      findings: [],
      onSelectFinding,
    })), /No findings in the available events/);

    assert.match(renderToStaticMarkup(createElement(ScenarioSelector, {
      scenarios: mockScenarios,
      onChange: () => {},
    })), /unauthorized_transfer/);
    assert.match(renderToStaticMarkup(createElement(ScenarioSelector, {
      scenarios: [],
      onChange: () => {},
    })), /No scenarios available/);
  } finally {
    await server.close();
  }
});
