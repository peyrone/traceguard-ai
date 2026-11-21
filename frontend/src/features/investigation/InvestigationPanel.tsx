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
  onInspect?: (id: string) => void;
  state?: LoadState;
}

interface ControlledExplanationProps {
  onExplain: () => void;
  explanation: ExplainResponse | null;
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
  return <ExplanationContent state={state} onExplain={props.onExplain} onInspect={props.onInspect} />;
}

export function InvestigationPanel(props: InvestigationPanelProps) {
  const { findings, onSelectFinding, selectedFindingId, graph, requestExplanation, state } = props;
  const [localSelection, setLocalSelection] = useState<Finding | null>(null);
  const ready = state === undefined || state.status === "ready";
  const selection = selectedFindingId === undefined
    ? findings.find((item) => item === localSelection)
    : findings.find((item) => item.id === selectedFindingId);
  const finding = ready ? selection ?? null : null;

  let explanationPanel;
  if (finding !== null && props.onExplain !== undefined) {
    explanationPanel = <ControlledExplanation key={finding.id} {...props} />;
  } else if (finding !== null && requestExplanation !== undefined) {
    explanationPanel = <ExplanationPanel finding={finding} onRequest={requestExplanation} />;
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
