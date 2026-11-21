import assert from "node:assert/strict";
import test from "node:test";
import { scenarioFixtures } from "./scenarios.ts";

test("shuffled events preserve analysis without sharing input order", () => {
  const direct = scenarioFixtures.unauthorized_transfer;
  const shuffled = scenarioFixtures.shuffled_transfer;
  assert.notDeepEqual(direct.events, shuffled.events);
  assert.deepEqual(
    [...direct.events].sort((a, b) => a.event_id.localeCompare(b.event_id)),
    [...shuffled.events].sort((a, b) => a.event_id.localeCompare(b.event_id)),
  );
  assert.deepEqual(direct.analysis, shuffled.analysis);
});

test("all five scenarios have connected service nodes and traceable evidence", () => {
  assert.equal(Object.keys(scenarioFixtures).length, 5);
  for (const { scenario, analysis, events } of Object.values(scenarioFixtures)) {
    const eventsById = new Map(events.map((event) => [event.event_id, event]));
    assert.equal(analysis.summary.events_processed, eventsById.size, scenario.id);
    assert.ok(analysis.graph.nodes.length >= 5, scenario.id);
    const endpoints = new Set(analysis.graph.edges.flatMap(({ source, target }) => [source, target]));
    assert.deepEqual(new Set(analysis.graph.nodes.map(({ id }) => id)), endpoints);
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

test("all allowed-scenario transfers are classified under the demo PII policy", () => {
  const { events } = scenarioFixtures.allowed_transfer;
  assert.equal(events.length, 4);
  for (const event of events) {
    assert.equal(event.classification, "PII", event.event_id);
    assert.equal(event.purpose, "CUSTOMER_SERVICE", event.event_id);
  }
});
