import { EvidenceId } from "./EvidenceId";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ExplainResponse, Finding } from "../../lib/api/types.ts";

export type RequestExplanation = (finding: Finding, signal: AbortSignal) => Promise<ExplainResponse>;

type ExplanationState =
  | { status: "loading" }
  | { status: "ready"; result: ExplainResponse }
  | { status: "error"; message: string };

interface ExplanationContentProps {
  onInspect?: (id: string) => void;
  state?: ExplanationState;
  onExplain: () => void;
  finding?: Finding;
  relatedEvidence?: ReactNode;
}

interface ExplanationPanelProps {
  finding: Finding;
  onRequest: RequestExplanation;
  relatedEvidence?: ReactNode;
}

export function ExplanationPanel({ finding, onRequest, relatedEvidence }: ExplanationPanelProps) {
  const [lastRequest, setLastRequest] = useState<{ finding: Finding; state: ExplanationState }>();
  const activeRequest = useRef<AbortController | null>(null);
  const state = lastRequest?.finding === finding ? lastRequest.state : undefined;

  useEffect(() => () => activeRequest.current?.abort(), [finding]);

  async function explain() {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLastRequest({ finding, state: { status: "loading" } });
    try {
      const result = await onRequest(finding, controller.signal);
      if (!controller.signal.aborted) setLastRequest({ finding, state: { status: "ready", result } });
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : "Could not load the explanation.";
        setLastRequest({ finding, state: { status: "error", message } });
      }
    }
  }

  return <ExplanationContent state={state} onExplain={explain} finding={finding} relatedEvidence={relatedEvidence} />;
}

export function ExplanationContent({ state, onExplain, onInspect, finding, relatedEvidence }: ExplanationContentProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="surface explanation" aria-label="Explanation">
      <button className="explain-disclosure" type="button" aria-expanded={expanded} onClick={() => {
        setExpanded(!expanded);
        if (!expanded && !state) onExplain();
      }}>{expanded ? "Hide explanation" : "Explain finding"} <span aria-hidden="true">{expanded ? "−" : "+"}</span></button>
      <div className="explanation-body" hidden={!expanded}>
      {finding && <p>Selected rule <code>{finding.rule_id}</code></p>}
      {state?.status === "error" && <button type="button" onClick={onExplain}>Retry explanation</button>}
      {state?.status === "loading" && <p role="status">Loading explanation…</p>}
      {state?.status === "error" && <p role="alert">{state.message}</p>}
      {relatedEvidence}
      {state?.status === "ready" && (
        <div className="tg-explanation-result" aria-live="polite">
          <p className="tg-explanation-mode">{state.result.mode === "ai" ? "AI-prioritized next steps" : "Rule-based fallback"}</p>
          <p>{state.result.explanation}</p>
          {state.result.evidence_event_ids.length > 0 && (
            <ul className="tg-event-ids" aria-label="Cited audit events">
              {state.result.evidence_event_ids.map((id) => <li key={id}><EvidenceId id={id} onInspect={onInspect} /></li>)}
            </ul>
          )}
          {state.result.next_steps.length > 0 && (
            <>
              <h3>Next steps</h3>
              <ul className="tg-detail-list">
                {state.result.next_steps.map((step, index) => <li key={index}>{step}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
