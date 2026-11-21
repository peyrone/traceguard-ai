import type { AnalyzeResponse, AuditEvent, GraphEdge, GraphNode, Scenario } from "../api/types.ts";

interface ScenarioFixture {
  scenario: Scenario;
  events: AuditEvent[];
  analysis: AnalyzeResponse;
}

const customer: GraphNode = { id: "customer-api", label: "Customer API", kind: "internal" };
const sales: GraphNode = { id: "sales-api", label: "Sales API", kind: "internal" };
const consent: GraphNode = { id: "consent-api", label: "Consent API", kind: "internal" };
const internalGateway: GraphNode = { id: "internal-gateway", label: "Internal Gateway", kind: "internal" };
const internalCRM: GraphNode = { id: "internal-crm", label: "Internal CRM", kind: "internal" };
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

function completedSend({ suffix, second, source, target, template = allowedEvent }: {
  suffix: string;
  second: number;
  source: GraphNode;
  target: GraphNode;
  template?: AuditEvent;
}) {
  return {
    ...template,
    event_id: `evt-${suffix}`,
    transfer_id: `xfer-${suffix}`,
    occurred_at: `2026-11-21T03:10:${String(second).padStart(2, "0")}Z`,
    observed_at: `2026-11-21T03:10:${second + 10}Z`,
    service: source.id,
    action: "DATA_SENT",
    outcome: "COMPLETED",
    source_service: source.id,
    destination_service: target.id,
  } satisfies AuditEvent;
}

function observedEdge(event: ReturnType<typeof completedSend>): GraphEdge {
  return {
    id: `edge-${event.event_id}`,
    source: event.source_service,
    target: event.destination_service,
    evidence_status: "OBSERVED",
    evidence_event_ids: [event.event_id],
  };
}

const consentSend = completedSend({ suffix: "005", second: 4, source: customer, target: consent });
const gatewaySend = completedSend({ suffix: "006", second: 5, source: sales, target: internalGateway });
const crmSend = completedSend({ suffix: "007", second: 6, source: internalGateway, target: internalCRM });
const approvedBranches = [consentSend, gatewaySend, crmSend];
const operationalEvents = approvedBranches.map((event) => ({
  ...event, data_ref: "synthetic-ops-001",
}));
const caseTemplate = { ...allowedEvent, data_ref: "synthetic-case-001" };
const unrelatedGatewaySend = completedSend({
  suffix: "006", second: 2, source: sales, target: internalGateway, template: caseTemplate,
});
const unrelatedCRMSend = completedSend({
  suffix: "007", second: 3, source: internalGateway, target: internalCRM, template: caseTemplate,
});

const partialTemplate = { ...allowedEvent, trace_id: "trace-e-001", data_ref: "synthetic-subject-e-001" };
const partialReceipt: AuditEvent = {
  ...partialTemplate,
  event_id: "evt-e-001",
  transfer_id: "xfer-e-001",
  service: sales.id,
  action: "DATA_RECEIVED",
};
const partialOutbound = {
  ...completedSend({ suffix: "e-002", second: 3, source: sales, target: external, template: partialTemplate }),
  observed_at: "2026-11-21T03:10:32Z",
};
const partialIntake = completedSend({
  suffix: "e-003", second: 0, source: consent, target: customer, template: partialTemplate,
});
const partialCRMSend = completedSend({
  suffix: "e-004", second: 2, source: sales, target: internalCRM, template: partialTemplate,
});

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

const directEvents = [allowedEvent, processedEvent, deniedEvent, ...approvedBranches];
const directAnalysis: AnalyzeResponse = {
  summary: { status: "VERIFIED_VIOLATION", events_processed: directEvents.length },
  graph: {
    nodes: [customer, sales, external, consent, internalGateway, internalCRM],
    edges: [allowedEdge, directEdge, ...approvedBranches.map(observedEdge)],
  },
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
    events: [allowedEvent, ...operationalEvents],
    analysis: {
      summary: { status: "NO_VIOLATION_OBSERVED", events_processed: 1 + operationalEvents.length },
      graph: {
        nodes: [customer, sales, consent, internalGateway, internalCRM],
        edges: [allowedEdge, ...operationalEvents.map(observedEdge)],
      },
      findings: [],
    },
  },
  unauthorized_transfer: {
    scenario: { id: "unauthorized_transfer", label: "Unauthorized transfer" },
    events: directEvents,
    analysis: directAnalysis,
  },
  shuffled_transfer: {
    scenario: { id: "shuffled_transfer", label: "Shuffled audit events" },
    events: [crmSend, deniedEvent, allowedEvent, gatewaySend, processedEvent, consentSend],
    analysis: directAnalysis,
  },
  missing_intermediate: {
    scenario: { id: "missing_intermediate", label: "Missing intermediate evidence" },
    events: [allowedEvent, unrelatedGatewaySend, unrelatedCRMSend, receivingClue],
    analysis: {
      summary: { status: "POTENTIAL_VIOLATION", events_processed: 4 },
      graph: {
        nodes: [customer, sales, external, internalGateway, internalCRM],
        edges: [allowedEdge, inferredEdge, observedEdge(unrelatedGatewaySend), observedEdge(unrelatedCRMSend)],
      },
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
  partial_evidence_confirmed: {
    scenario: { id: "partial_evidence_confirmed", label: "Partial evidence, confirmed violation" },
    events: [partialIntake, partialReceipt, partialCRMSend, partialOutbound],
    analysis: {
      summary: { status: "VERIFIED_VIOLATION", events_processed: 4 },
      graph: {
        nodes: [consent, customer, sales, internalCRM, external],
        edges: [
          observedEdge(partialIntake),
          {
            ...allowedEdge,
            evidence_status: "INFERRED",
            evidence_event_ids: [partialReceipt.event_id],
          },
          observedEdge(partialCRMSend),
          observedEdge(partialOutbound),
        ],
      },
      findings: [
        {
          id: "finding-missing-upstream-send",
          rule_id: "TRANSFER_POLICY",
          status: "INCONCLUSIVE",
          message: "The Sales API receipt lacks a matching completed send from Customer API.",
          evidence_event_ids: [partialReceipt.event_id],
          missing_evidence: ["Completed send event linking Customer API to Sales API."],
        },
        {
          id: "finding-denied-destination",
          rule_id: "DENY_EXTERNAL_PII",
          status: "VERIFIED_VIOLATION",
          message: "Completed transfer to an unapproved destination.",
          evidence_event_ids: [partialOutbound.event_id],
          missing_evidence: [],
        },
      ],
    },
  },
} satisfies Record<string, ScenarioFixture>;

export const mockScenarios = Object.values(scenarioFixtures).map(({ scenario }) => scenario);
