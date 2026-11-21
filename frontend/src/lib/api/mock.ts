import { mockScenarios, scenarioFixtures } from "../fixtures/scenarios.ts";
import { TraceGuardApiError } from "./client.ts";
import { localExplanation } from "./explanation.ts";
import type { TraceGuardClient } from "./types.ts";

const fixturesById = new Map(Object.values(scenarioFixtures).map((fixture) => [fixture.scenario.id, fixture]));

export function createMockTraceGuardClient(): TraceGuardClient {
  return {
    async listScenarios(signal) {
      signal?.throwIfAborted();
      return structuredClone(mockScenarios);
    },
    async analyze(request, signal) {
      signal?.throwIfAborted();
      if (request.scenario_id === undefined || request.policy !== undefined) {
        throw new TraceGuardApiError(400, "INVALID_REQUEST", "Mock mode accepts the predefined scenarios.");
      }
      const fixture = fixturesById.get(request.scenario_id);
      if (fixture === undefined) throw new TraceGuardApiError(404, "SCENARIO_NOT_FOUND", "Unknown scenario.");
      return structuredClone(fixture.analysis);
    },
    async explain(request, signal) {
      signal?.throwIfAborted();
      const { explanation, next_steps, evidence_event_ids } = localExplanation(request);
      return { mode: "fallback", explanation: [explanation, request.rule_summary].join(" "), next_steps, evidence_event_ids };
    },
  };
}
