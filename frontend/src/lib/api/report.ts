import copy from "../../../../backend/internal/domain/traceguard/core/services/investigation/report-copy.json";
import type { AnalyzeResponse, CaseSummary, ReportRequest, ReportSection } from "./types";

export function matchesAnalysis(summary: CaseSummary, request: ReportRequest, analysis: AnalyzeResponse) {
  const cited = new Set([...analysis.graph.edges, ...analysis.findings].flatMap(item => item.evidence_event_ids));
  const rules = new Set(analysis.findings.map(f => f.rule_id));
  return summary.scenario_id === request.scenario_id && summary.audience === request.audience
    && summary.language === request.language && summary.status === analysis.summary.status
    && summary.sections.every(s => s.evidence_event_ids.every(id => cited.has(id)) && (!s.rule_id || rules.has(s.rule_id)));
}

// Reconstruct the offline edition exclusively from the analysis already loaded for this case.
export function localReport(request: ReportRequest, analysis: AnalyzeResponse): CaseSummary {
  const { language, audience } = request;
  const { status } = analysis.summary;
  const primary = analysis.findings.filter(f => f.status === status);
  const ids = [...new Set(primary.flatMap(f => f.evidence_event_ids))];
  const sections: ReportSection[] = [];
  for (const f of primary) {
    let text = copy[status][language];
    if (status === "VERIFIED_VIOLATION" || status === "POTENTIAL_VIOLATION") {
      if (f.rule_id === "DENY_EXTERNAL_PII") text += " " + copy.outside_destination[language];
      if (f.rule_id === "DENY_PURPOSE") text += " " + copy.outside_purpose[language];
      const expected = status === "VERIFIED_VIOLATION" ? "OBSERVED" : "INFERRED";
      const edge = analysis.graph.edges.find(e => e.evidence_status === expected
        && e.evidence_event_ids.some(id => f.evidence_event_ids.includes(id)));
      if (edge) text += " " + edge.source + " → " + edge.target;
    }
    sections.push({ kind: "conclusion", text, evidence_event_ids: f.evidence_event_ids, rule_id: f.rule_id });
  }
  if (!sections.length) sections.push({ kind: "conclusion", text: copy[status][language], evidence_event_ids: [] });
  const gaps = new Set<string>();
  for (const e of analysis.graph.edges) {
    const inferred = e.evidence_status === "INFERRED";
    if (inferred) e.evidence_event_ids.forEach(id => gaps.add(id));
    if (inferred || audience === "engineering") sections.push({
      kind: inferred ? "uncertainty" : "route",
      text: (inferred ? copy.inferred : copy.observed)[language] + " · " + e.source + " → " + e.target,
      evidence_event_ids: e.evidence_event_ids,
    });
  }
  if (audience === "engineering") {
    for (const f of analysis.findings) {
      for (const gap of f.missing_evidence) {
        const text = Object.hasOwn(copy, gap) ? copy[gap as keyof typeof copy][language] : copy.other_gap[language];
        sections.push({ kind: "uncertainty", text, rule_id: f.rule_id, evidence_event_ids: f.evidence_event_ids });
      }
    }
  }
  if (!gaps.size) sections.push({ kind: "uncertainty", text: copy.scope[language], evidence_event_ids: [] });
  function action(key: "review_export" | "collect_records" | "check_policy", refs = ids) {
    sections.push({ kind: "action", text: copy[`${audience}.${key}`][language], evidence_event_ids: refs });
  }
  if (status === "VERIFIED_VIOLATION") action("review_export");
  if (gaps.size || status === "POTENTIAL_VIOLATION" || status === "INCONCLUSIVE") action("collect_records", gaps.size ? [...gaps] : ids);
  action("check_policy");
  return { ...request, status, mode: "fallback", sections };
}
