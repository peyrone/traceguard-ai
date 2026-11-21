import { useState } from "react";
import type { ExplainResponse, Finding, Graph } from "../../lib/api/types.ts";
import { EvidencePanel } from "./EvidencePanel.tsx";
import { ExplanationContent, ExplanationPanel, type RequestExplanation } from "./ExplanationPanel.tsx";
import { FindingsPanel } from "./FindingsPanel.tsx";
import type { LoadState } from "./state.ts";
import "./investigation.css";

export { statusLabels } from "./FindingsPanel.tsx";

interface InvestigationProps {
  findings: Finding[];
  onSelectFinding: (id: string) => void;
  selectedFindingId?: string | null;
  graph?: Graph;
  state?: LoadState;
}

type InvestigationPanelProps = InvestigationProps & (
  | {
      onExplain: () => void;
      explanation: ExplainResponse | null;
      explanationError: string | null;
      explaining: boolean;
      requestExplanation?: never;
    }
  | { onExplain?: never; requestExplanation?: RequestExplanation }
);

export function InvestigationPanel(props: InvestigationPanelProps) {
  const { findings, onSelectFinding, selectedFindingId, graph, requestExplanation, state } = props;
  const [localSelection, setLocalSelection] = useState<Finding | null>(null);
  const ready = state === undefined || state.status === "ready";
  const selection = selectedFindingId === undefined
    ? findings.find((item) => item === localSelection)
    : findings.find((item) => item.id === selectedFindingId);
  const finding = ready ? selection ?? null : null;

  const outboundSources = new Set(graph?.edges
    .filter((edge) => finding?.status === "VERIFIED_VIOLATION" && edge.evidence_status === "OBSERVED" &&
      edge.evidence_event_ids.some((id) => finding.evidence_event_ids.includes(id)))
    .map((edge) => edge.source));
  const upstreamLinks = graph?.edges.filter((edge) =>
    edge.evidence_status === "INFERRED" && outboundSources.has(edge.target),
  ) ?? [];
  const relatedFindings = findings.filter((item) => item.status === "INCONCLUSIVE" &&
    upstreamLinks.some((edge) => edge.evidence_event_ids.some((id) => item.evidence_event_ids.includes(id))));
  const nodeLabels = new Map(graph?.nodes.map(({ id, label }) => [id, label]));
  const relatedEvidence = relatedFindings.length > 0 && (
    <section aria-label="Separate upstream finding">
      <h3>Separate upstream finding</h3>
      <p>The shared service leaves the data’s upstream origin unresolved.</p>
      <ul className="tg-detail-list">
        {relatedFindings.map((item) => (
          <li key={item.id}>
            <strong>Inconclusive · Inferred link</strong>
            {upstreamLinks.filter((edge) => edge.evidence_event_ids.some((id) => item.evidence_event_ids.includes(id)))
              .map((edge) => <span key={edge.id}> {nodeLabels.get(edge.source) ?? edge.source} → {nodeLabels.get(edge.target) ?? edge.target}</span>)}
            <span> · {item.evidence_event_ids.map((id) => <code key={id}>{id} </code>)}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  let explanationPanel;
  if (finding !== null && props.onExplain !== undefined) {
    let explanationState: Parameters<typeof ExplanationContent>[0]["state"];
    if (props.explaining) {
      explanationState = { status: "loading" };
    } else if (props.explanationError !== null) {
      explanationState = { status: "error", message: props.explanationError };
    } else if (props.explanation !== null) {
      explanationState = { status: "ready", result: props.explanation };
    }
    explanationPanel = <ExplanationContent state={explanationState} onExplain={props.onExplain} finding={finding} relatedEvidence={relatedEvidence} />;
  } else if (finding !== null && requestExplanation !== undefined) {
    explanationPanel = <ExplanationPanel finding={finding} onRequest={requestExplanation} relatedEvidence={relatedEvidence} />;
  }

  return (
    <div className={props.onExplain === undefined ? "tg-investigation" : "investigation-panel tg-investigation"}>
      <FindingsPanel
        findings={findings}
        onSelectFinding={(id) => {
          if (selectedFindingId === undefined) {
            setLocalSelection(findings.find((item) => item.id === id) ?? null);
          }
          onSelectFinding(id);
        }}
        selectedFindingId={finding?.id}
        state={state}
      />
      {ready && findings.length > 0 && <EvidencePanel finding={finding} graph={graph} />}
      {explanationPanel}
    </div>
  );
}
