import type { AnalyzeResponse, AuditEvent, GraphEdge, GraphNode, Scenario } from "../api/types.ts";

interface ScenarioFixture {
  scenario: Scenario;
  events: AuditEvent[];
  analysis: AnalyzeResponse;
}

const customer: GraphNode = { id: "customer-api", label: "Customer API", kind: "internal" };
const sales: GraphNode = { id: "sales-api", label: "Sales API", kind: "internal" };
const external: GraphNode = { id: "external-crm", label: "External CRM", kind: "external" };

const allowedEvent: AuditEvent = {
  event_id: "evt-001",
  trace_id: "trace-001",
  transfer_id: "xfer-001",
  occurred_at: "2026-11-21T03:10:01Z",
  observed_at: "2026-11-21T03:10:30Z",
  service: customer.id,
  action: "DATA_SENT",
  outcome: "COMPLETED",
  source_service: customer.id,
  destination_service: sales.id,
  data_ref: "synthetic-subject-001",
  classification: "PII",
  purpose: "CUSTOMER_SERVICE",
};

const processedEvent: AuditEvent = {
  ...allowedEvent,
  event_id: "evt-002",
  transfer_id: "xfer-002",
  occurred_at: "2026-11-21T03:10:02Z",
  observed_at: "2026-11-21T03:10:12Z",
  service: sales.id,
  action: "DATA_PROCESSED",
  source_service: sales.id,
  destination_service: sales.id,
};

const deniedEvent: AuditEvent = {
  ...allowedEvent,
  event_id: "evt-003",
  transfer_id: "xfer-003",
  occurred_at: "2026-11-21T03:10:03Z",
  observed_at: "2026-11-21T03:10:13Z",
  service: sales.id,
  source_service: sales.id,
  destination_service: external.id,
  purpose: "MARKETING",
};

const receivingClue: AuditEvent = {
  ...deniedEvent,
  event_id: "evt-004",
  transfer_id: "xfer-004",
  occurred_at: "2026-11-21T03:10:04Z",
  observed_at: "2026-11-21T03:10:14Z",
  service: external.id,
  action: "DATA_RECEIVED",
  source_service: undefined,
};

const allowedEdge: GraphEdge = {
  id: "edge-customer-sales",
  source: customer.id,
  target: sales.id,
  evidence_status: "OBSERVED",
  evidence_event_ids: [allowedEvent.event_id],
};

const directEdge: GraphEdge = {
  id: "edge-sales-external",
  source: sales.id,
  target: external.id,
  evidence_status: "OBSERVED",
  evidence_event_ids: [deniedEvent.event_id],
};

const inferredEdge: GraphEdge = {
  ...directEdge,
  evidence_status: "INFERRED",
  evidence_event_ids: [allowedEvent.event_id, receivingClue.event_id],
};

const directAnalysis: AnalyzeResponse = {
  summary: { status: "VERIFIED_VIOLATION", events_processed: 3 },
  graph: { nodes: [customer, sales, external], edges: [allowedEdge, directEdge] },
  findings: [{
    id: "finding-denied-destination",
    rule_id: "DENY_EXTERNAL_PII",
    status: "VERIFIED_VIOLATION",
    message: "Completed transfer to an unapproved destination.",
    evidence_event_ids: [deniedEvent.event_id],
    missing_evidence: [],
  }],
};

export const scenarioFixtures = {
  allowed_transfer: {
    scenario: { id: "allowed_transfer", label: "Allowed transfer" },
    events: [allowedEvent],
    analysis: {
      summary: { status: "NO_VIOLATION_OBSERVED", events_processed: 1 },
      graph: { nodes: [customer, sales], edges: [allowedEdge] },
      findings: [],
    },
  },
  unauthorized_transfer: {
    scenario: { id: "unauthorized_transfer", label: "Unauthorized transfer" },
    events: [allowedEvent, processedEvent, deniedEvent],
    analysis: directAnalysis,
  },
  shuffled_transfer: {
    scenario: { id: "shuffled_transfer", label: "Shuffled audit events" },
    events: [deniedEvent, allowedEvent, processedEvent],
    analysis: directAnalysis,
  },
  missing_intermediate: {
    scenario: { id: "missing_intermediate", label: "Missing intermediate evidence" },
    events: [allowedEvent, receivingClue],
    analysis: {
      summary: { status: "POTENTIAL_VIOLATION", events_processed: 2 },
      graph: { nodes: [customer, sales, external], edges: [allowedEdge, inferredEdge] },
      findings: [{
        id: "finding-unconfirmed-destination",
        rule_id: "DENY_EXTERNAL_PII",
        status: "POTENTIAL_VIOLATION",
        message: "A receiving event suggests a transfer to an unapproved destination.",
        evidence_event_ids: [receivingClue.event_id],
        missing_evidence: ["Completed send event linking Sales API to External CRM."],
      }],
    },
  },
} satisfies Record<string, ScenarioFixture>;

export const mockScenarios = Object.values(scenarioFixtures).map(({ scenario }) => scenario);
