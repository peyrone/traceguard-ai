import { useLanguage } from '../../lib/language';
import { useState, type ReactNode } from "react";
import type { Explanation, Finding, Graph } from "../../lib/api/types.ts";
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
  onInspect?: (id: string) => void;
  state?: LoadState;
}

interface ControlledExplanationProps {
  finding?: Finding;
  relatedEvidence?: ReactNode;
  onExplain: () => void;
  explanation: Explanation | null;
  explanationError: string | null;
  explaining: boolean;
  onInspect?: (id: string) => void;
}

type InvestigationPanelProps = InvestigationProps & (
  | (ControlledExplanationProps & { requestExplanation?: never })
  | { onExplain?: never; requestExplanation?: RequestExplanation }
);

export function ControlledExplanation(props: ControlledExplanationProps) {
  let state: Parameters<typeof ExplanationContent>[0]["state"];
  if (props.explaining) state = { status: "loading" };
  else if (props.explanationError !== null) state = { status: "error", message: props.explanationError };
  else if (props.explanation !== null) state = { status: "ready", result: props.explanation };
  return <ExplanationContent finding={props.finding} relatedEvidence={props.relatedEvidence} state={state} onExplain={props.onExplain} onInspect={props.onInspect} />;
}

export function UpstreamEvidence({ graph, finding, findings }: {
  graph?: Graph;
  finding: Finding;
  findings: Finding[];
}) {
  const { t } = useLanguage();
  const outboundSources = new Set(graph?.edges
    .filter((edge) => finding.status === "VERIFIED_VIOLATION" && edge.evidence_status === "OBSERVED" &&
      edge.evidence_event_ids.some((id) => finding.evidence_event_ids.includes(id)))
    .map((edge) => edge.source));
  const upstreamLinks = graph?.edges.filter((edge) =>
    edge.evidence_status === "INFERRED" && outboundSources.has(edge.target),
  ) ?? [];
  const relatedFindings = findings.filter((item) => item.status === "INCONCLUSIVE" &&
    upstreamLinks.some((edge) => edge.evidence_event_ids.some((id) => item.evidence_event_ids.includes(id))));
  const nodeLabels = new Map(graph?.nodes.map(({ id, label }) => [id, label]));
  return relatedFindings.length > 0 ? (
    <section aria-label={t("Separate upstream finding")}>
      <h3>{t("Separate upstream finding")}</h3>
      <p>{t("The shared service leaves the data’s upstream origin unresolved.")}</p>
      <ul className="tg-detail-list">
        {relatedFindings.map((item) => (
          <li key={item.id}>
            <strong>{t("Inconclusive · Inferred link")}</strong>
            {upstreamLinks.filter((edge) => edge.evidence_event_ids.some((id) => item.evidence_event_ids.includes(id)))
              .map((edge) => <span key={edge.id}> {nodeLabels.get(edge.source) ?? edge.source} → {nodeLabels.get(edge.target) ?? edge.target}</span>)}
            <span> · {item.evidence_event_ids.map((id) => <code key={id}>{id} </code>)}</span>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}

export function InvestigationPanel(props: InvestigationPanelProps) {
  const { findings, onSelectFinding, selectedFindingId, graph, requestExplanation, state } = props;
  const [localSelection, setLocalSelection] = useState<Finding | null>(null);
  const ready = state === undefined || state.status === "ready";
  const selection = selectedFindingId === undefined
    ? findings.find((item) => item === localSelection)
    : findings.find((item) => item.id === selectedFindingId);
  const finding = ready ? selection ?? null : null;

  const relatedEvidence = finding && <UpstreamEvidence graph={graph} finding={finding} findings={findings} />;
  let explanationPanel;
  if (finding !== null && props.onExplain !== undefined) {
    explanationPanel = <ControlledExplanation key={finding.id} {...props} finding={finding} relatedEvidence={relatedEvidence} />;
  } else if (finding !== null && requestExplanation !== undefined) {
    explanationPanel = <ExplanationPanel relatedEvidence={relatedEvidence} finding={finding} onRequest={requestExplanation} />;
  }

  return (
    <>
      <div className="surface inspector">
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
        {ready && findings.length > 0 && <EvidencePanel finding={finding} graph={graph} onInspect={props.onInspect} />}
      </div>
      {explanationPanel}
    </>
  );
}
