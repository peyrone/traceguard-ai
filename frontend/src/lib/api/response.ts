import type {
  AnalysisStatus,
  CaseSummary,
  AnalyzeResponse,
  ExplainResponse,
  GDPRMapping,
  InvestigationInsight,
  Finding,
  GraphEdge,
  GraphNode,
  Scenario,
  PrivacyDecisionResponse,
  TransferCandidate,
} from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isList<T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

function isStatus(value: unknown): value is AnalysisStatus {
  return value === "VERIFIED_VIOLATION" || value === "POTENTIAL_VIOLATION"
    || value === "INCONCLUSIVE" || value === "NO_VIOLATION_OBSERVED";
}

function isScenario(value: unknown): value is Scenario {
  return isObject(value) && isString(value.id) && isString(value.label);
}

export function isScenarioList(value: unknown): value is Scenario[] {
  return isList(value, isScenario);
}

function isGraphNode(value: unknown): value is GraphNode {
  return isScenario(value) && "kind" in value && isString(value.kind);
}

function isGraphEdge(value: unknown): value is GraphEdge {
  return isObject(value) && isString(value.id) && isString(value.source) && isString(value.target)
    && (value.evidence_status === "OBSERVED" || value.evidence_status === "INFERRED")
    && isList(value.evidence_event_ids, isString);
}

function isFinding(value: unknown): value is Finding {
  return isObject(value) && isString(value.id) && isString(value.rule_id) && isStatus(value.status)
    && isString(value.message) && isList(value.evidence_event_ids, isString)
    && isList(value.missing_evidence, isString);
}

function isTransferCandidate(value: unknown): value is TransferCandidate {
  return isObject(value)
    && isString(value.id) && isString(value.edge_id)
    && isString(value.source_service) && isString(value.destination_service)
    && (value.evidence_status === "OBSERVED" || value.evidence_status === "INFERRED")
    && isList(value.evidence_event_ids, isString) && value.evidence_event_ids.length > 0
    && (value.classification === undefined || isString(value.classification))
    && (value.purpose === undefined || isString(value.purpose))
    && isString(value.policy_id);
}

export function isAnalyzeResponse(value: unknown): value is AnalyzeResponse {
  return isObject(value)
    && isObject(value.summary) && isStatus(value.summary.status)
    && typeof value.summary.events_processed === "number" && Number.isInteger(value.summary.events_processed)
    && value.summary.events_processed >= 0
    && isObject(value.graph) && isList(value.graph.nodes, isGraphNode) && isList(value.graph.edges, isGraphEdge)
    && isList(value.findings, isFinding)
    && (value.transfer_candidates === undefined || isList(value.transfer_candidates, isTransferCandidate));
}

function isInsight(value: unknown): value is InvestigationInsight {
  return isObject(value) && isString(value.text)
    && (value.kind === "observation" || value.kind === "policy_concern" || value.kind === "uncertainty")
    && isList(value.evidence_event_ids, isString) && value.evidence_event_ids.length > 0;
}

function isGDPRMapping(value: unknown): value is GDPRMapping {
  return isObject(value) && isObject(value.reference) && isString(value.reference.article)
    && isString(value.reference.title) && isString(value.reference.criteria)
    && isString(value.reference.source_url) && value.reference.source_url.startsWith("https://eur-lex.europa.eu/")
    && isString(value.reference.guidance_url) && value.reference.guidance_url.startsWith("https://www.edpb.europa.eu/")
    && (value.assessment === "potential_concern" || value.assessment === "insufficient_information")
    && isString(value.rationale) && isList(value.evidence_event_ids, isString) && value.evidence_event_ids.length > 0
    && isList(value.missing_facts, isString) && value.missing_facts.length > 0;
}

export function isExplainResponse(value: unknown): value is ExplainResponse {
  return isObject(value) && isString(value.explanation) && isList(value.next_steps, isString)
    && isList(value.evidence_event_ids, isString) && (value.mode === "ai" || value.mode === "fallback")
    && (value.insights === undefined || isList(value.insights, isInsight))
    && (value.gdpr_mappings === undefined || isList(value.gdpr_mappings, isGDPRMapping));
}

export function isErrorResponse(value: unknown): value is { code: string; message: string } {
  return isObject(value) && isString(value.code) && isString(value.message);
}

export function isPrivacyDecisionResponse(value: unknown): value is PrivacyDecisionResponse {
  return isObject(value) &&
    (value.decision === "ALLOW" || value.decision === "DENY" || value.decision === "INDETERMINATE") &&
    isString(value.rule_id) && isString(value.reason) &&
    typeof value.transfer_executed === "boolean" &&
    (value.decision === "ALLOW" || !value.transfer_executed);
}

export function isCaseSummary(value: unknown): value is CaseSummary {
  return isObject(value) && isString(value.scenario_id) && isStatus(value.status)
    && (value.audience === "executive" || value.audience === "engineering")
    && (value.language === "en" || value.language === "th")
    && (value.mode === "ai" || value.mode === "fallback")
    && Array.isArray(value.sections) && value.sections.length > 0
    && value.sections.every(s => isObject(s) && ["conclusion", "uncertainty", "action", "route"].includes(String(s.kind))
      && isString(s.text) && s.text.trim() !== "" && isList(s.evidence_event_ids, isString)
      && (s.rule_id === undefined || isString(s.rule_id)));
}
