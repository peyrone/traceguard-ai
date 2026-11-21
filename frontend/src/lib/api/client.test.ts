import assert from "node:assert/strict";
import test from "node:test";
import { scenarioFixtures, mockScenarios } from "../fixtures/scenarios.ts";
import { apiURL, createTraceGuardClient, TraceGuardApiError } from "./client.ts";
import { createMockTraceGuardClient } from "./mock.ts";
import { createExplainRequest } from "./explanation.ts";

const fixture = scenarioFixtures.unauthorized_transfer;
const finding = fixture.analysis.findings[0];
const request = createExplainRequest({
  finding,
  ruleSummary: "Transfers require an approved destination and purpose.",
  events: fixture.events,
});

test("joins hosted and local URLs with each API endpoint", () => {
  for (const endpoint of ["scenarios", "analyze", "explain"] as const) {
    assert.equal(apiURL(" https://api.example.com/// ", endpoint), `https://api.example.com/api/v1/${endpoint}`);
  }
  assert.equal(apiURL("https://example.com/gateway/", "analyze"), "https://example.com/gateway/api/v1/analyze");
  assert.equal(apiURL("https://example.com/api/v1/", "explain"), "https://example.com/api/v1/explain");
  assert.equal(apiURL("", "scenarios"), "http://localhost:8080/api/v1/scenarios");
});

test("the HTTP client follows the OpenAPI paths and exact request bodies", async () => {
  assert.deepEqual(request.evidence, [{
    event_id: "evt-003",
    action: "DATA_SENT",
    outcome: "COMPLETED",
  }]);
  const replies = [
    mockScenarios,
    fixture.analysis,
    { explanation: "Verified violation.", next_steps: [], evidence_event_ids: ["evt-003"], mode: "ai" },
  ];
  const requests: Request[] = [];
  const client = createTraceGuardClient({
    baseUrl: "https://traceguard.example/api/v1/",
    fetch: async (input, options) => {
      requests.push(new Request(input, options));
      return Response.json(replies.shift());
    },
  });

  assert.deepEqual(await client.listScenarios(), mockScenarios);
  assert.deepEqual(await client.analyze({ scenario_id: fixture.scenario.id }), fixture.analysis);
  assert.equal((await client.explain(request)).mode, "ai");
  assert.deepEqual(requests.map(({ method, url }) => [method, new URL(url).pathname]), [
    ["GET", "/api/v1/scenarios"],
    ["POST", "/api/v1/analyze"],
    ["POST", "/api/v1/explain"],
  ]);
  assert.deepEqual(await requests[1].json(), { scenario_id: "unauthorized_transfer" });
  assert.deepEqual(await requests[2].json(), request);
});

test("the HTTP client handles API errors and rejects unknown evidence citations", async () => {
  const client = createTraceGuardClient({
    fetch: async () => Response.json({ code: "SCENARIO_NOT_FOUND", message: "Unknown scenario." }, { status: 404 }),
  });
  await assert.rejects(
    client.analyze({ scenario_id: "unknown" }),
    (error) => error instanceof TraceGuardApiError && error.status === 404 && error.code === "SCENARIO_NOT_FOUND",
  );

  const invalid = createTraceGuardClient({
    fetch: async () => Response.json({
      explanation: "Invalid citation.",
      next_steps: [],
      evidence_event_ids: ["evt-missing"],
      mode: "ai",
    }),
  });
  await assert.rejects(invalid.explain(request), /unknown evidence event ID/);
});

test("mock mode analyzes named scenarios and explains using the supplied finding evidence", async () => {
  const client = createMockTraceGuardClient();
  const missing = await client.analyze({ scenario_id: "missing_intermediate" });
  const result = await client.explain(createExplainRequest({
    finding: missing.findings[0],
    ruleSummary: request.rule_summary,
  }));
  assert.equal(result.mode, "fallback");
  assert.deepEqual(result.evidence_event_ids, ["evt-004"]);
  assert.match(result.explanation, /suggests a transfer/);
  assert.ok(result.next_steps.length > 0);
  await assert.rejects(client.analyze({ scenario_id: "unknown" }), /Unknown scenario/);
});

test("an unreachable explanation endpoint uses only evidence from the loaded finding", async () => {
  const client = createTraceGuardClient({ fetch: async () => { throw new TypeError("Failed to fetch"); } });
  const result = await client.explain({ ...request, evidence: [...request.evidence, { event_id: "other-case" }] });
  assert.equal(result.mode, "fallback");
  assert.equal(result.localFallback, true);
  assert.equal(result.explanation, finding.message);
  assert.deepEqual(result.evidence_event_ids, ["evt-003"]);
  const empty = await client.explain({ ...request, evidence: [] });
  assert.deepEqual(empty.evidence_event_ids, []);
  await assert.rejects(client.explain(request, AbortSignal.abort()), { name: "AbortError" });
});

test("HTTP and invalid explanation responses remain retryable errors", async () => {
  for (const response of [Response.json({}, { status: 403 }), Response.json({})]) {
    const client = createTraceGuardClient({ fetch: async () => response });
    await assert.rejects(client.explain(request));
  }
});
