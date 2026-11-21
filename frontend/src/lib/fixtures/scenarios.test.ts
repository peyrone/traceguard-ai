import assert from "node:assert/strict";
import test from "node:test";
import { scenarioFixtures } from "./scenarios.ts";

test("shuffled events preserve analysis without sharing input order", () => {
  const direct = scenarioFixtures.unauthorized_transfer;
  const shuffled = scenarioFixtures.shuffled_transfer;
  assert.notDeepEqual(
    direct.events.map(({ event_id }) => event_id),
    shuffled.events.map(({ event_id }) => event_id),
  );
  assert.deepEqual(direct.analysis, shuffled.analysis);
});

test("fixture findings and edges reference input events and keep inferred links distinct", () => {
  for (const { analysis, events } of Object.values(scenarioFixtures)) {
    const eventsById = new Map(events.map((event) => [event.event_id, event]));
    for (const edge of analysis.graph.edges) {
      assert.ok(edge.evidence_event_ids.length > 0);
      for (const id of edge.evidence_event_ids) assert.ok(eventsById.has(id));
      if (edge.evidence_status === "OBSERVED") {
        assert.ok(edge.evidence_event_ids.some((id) => {
          const event = eventsById.get(id);
          return event?.action === "DATA_SENT" && event.outcome === "COMPLETED"
            && event.source_service === edge.source && event.destination_service === edge.target;
        }));
      }
    }
    for (const { evidence_event_ids } of analysis.findings) {
      for (const id of evidence_event_ids) assert.ok(eventsById.has(id));
    }
  }

  const direct = scenarioFixtures.unauthorized_transfer.analysis;
  assert.equal(direct.summary.status, "VERIFIED_VIOLATION");
  assert.deepEqual(direct.findings[0]?.evidence_event_ids, ["evt-003"]);

  const missing = scenarioFixtures.missing_intermediate.analysis;
  assert.equal(missing.summary.status, "POTENTIAL_VIOLATION");
  assert.equal(missing.graph.edges.find(({ target }) => target === "external-crm")?.evidence_status, "INFERRED");
});
