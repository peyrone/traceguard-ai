import type { AuditEvent, ExplainRequest, Finding } from "./types.ts";

interface ExplainInput {
  finding: Finding;
  ruleSummary: string;
  events?: Pick<AuditEvent, "event_id" | "action" | "outcome">[];
}

export function createExplainRequest({ finding, ruleSummary, events = [] }: ExplainInput): ExplainRequest {
  const eventsById = new Map(events.map((event) => [event.event_id, event]));
  return {
    finding,
    rule_summary: ruleSummary,
    evidence: [...new Set(finding.evidence_event_ids)].map((event_id) => {
      const event = eventsById.get(event_id);
      if (event?.action === "DATA_SENT" || event?.action === "DATA_RECEIVED") {
        return { event_id, action: event.action, outcome: event.outcome };
      }
      return { event_id };
    }),
  };
}

export function evidenceIdsForRequest({ finding, evidence }: ExplainRequest): string[] {
  const suppliedIds = new Set(evidence.map(({ event_id }) => event_id));
  return [...new Set(finding.evidence_event_ids)].filter((id) => suppliedIds.has(id));
}
