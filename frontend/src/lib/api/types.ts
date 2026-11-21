export interface Scenario {
  id: string;
  label: string;
}

export type AnalysisStatus =
  | "VERIFIED_VIOLATION"
  | "POTENTIAL_VIOLATION"
  | "INCONCLUSIVE"
  | "NO_VIOLATION_OBSERVED";

export interface AuditEvent {
  event_id: string;
  trace_id?: string;
  transfer_id?: string;
  occurred_at: string;
  observed_at: string;
  service: string;
  action: string;
  outcome: "COMPLETED" | "ATTEMPTED" | "FAILED";
  source_service?: string;
  destination_service?: string;
  data_ref?: string;
  classification?: string;
  purpose?: string;
}

export interface Policy {
  policy_id: string;
  classification: string;
  allowed_destinations: string[];
  allowed_purposes: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  kind: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  evidence_status: "OBSERVED" | "INFERRED";
  evidence_event_ids: string[];
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Finding {
  id: string;
  rule_id: string;
  status: AnalysisStatus;
  message: string;
  evidence_event_ids: string[];
  missing_evidence: string[];
}

export interface AnalyzeResponse {
  summary: { status: AnalysisStatus; events_processed: number };
  graph: Graph;
  findings: Finding[];
}

export type AnalyzeRequest =
  | { scenario_id: string; events?: []; policy?: Policy }
  | { scenario_id?: never; events: AuditEvent[]; policy: Policy };

export interface ExplainEvidence {
  event_id: string;
  action?: string;
  outcome?: string;
}

export interface ExplainRequest {
  finding: Finding;
  rule_summary: string;
  evidence: ExplainEvidence[];
}

export interface ExplainResponse {
  explanation: string;
  next_steps: string[];
  evidence_event_ids: string[];
  mode: "ai" | "fallback";
}

export interface TraceGuardClient {
  listScenarios(signal?: AbortSignal): Promise<Scenario[]>;
  analyze(request: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse>;
  explain(request: ExplainRequest, signal?: AbortSignal): Promise<ExplainResponse>;
}
