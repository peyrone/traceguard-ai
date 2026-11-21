import { Icon } from "../../components/Icon";
import { EvidenceId } from "./EvidenceId";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  const id = useId();
  const fallback = state?.status === "ready" && state.result.mode === "fallback";
  return (
    <section className="surface explanation" aria-label="Explanation">
      <span className="explain-rim" data-muted={fallback || state?.status === "error"} aria-hidden="true" />
      <button className="explain-disclosure" type="button" aria-expanded={expanded}
        aria-controls={id} aria-labelledby={id + "-title"} aria-describedby={id + "-source"}
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && !state) onExplain();
        }}>
        <span className="explain-mark"><Icon name={fallback ? "index" : "sparkles"} size={22} /></span>
        <span className="explain-label">
          <strong id={id + "-title"}>{expanded ? "Hide explanation" : "Explain finding"}</strong>
          <span id={id + "-source"}>{fallback ? "Rule-based next steps" : "AI-assisted investigation"}</span>
        </span>
        <span className="explain-chevron" aria-hidden="true" />
      </button>
      <div id={id} className="explanation-body" hidden={!expanded}>
        {finding && <p className="explain-rule">Selected rule <code>{finding.rule_id}</code></p>}
        {state?.status === "loading" && <p role="status">Loading explanation…</p>}
        {state?.status === "error" && <>
          <p role="alert">{state.message}</p>
          <button type="button" onClick={onExplain}>Retry explanation</button>
        </>}
        {state?.status === "ready" && (
          <div className="tg-explanation-result" aria-live="polite">
            <p>{state.result.explanation}</p>
            {state.result.evidence_event_ids.length > 0 && (
              <ul className="tg-event-ids" aria-label="Cited audit events">
                {state.result.evidence_event_ids.map((id) => <li key={id}><EvidenceId id={id} onInspect={onInspect} /></li>)}
              </ul>
            )}
            {Boolean(state.result.insights?.length) && (
              <>
                <h3>Investigation insights</h3>
                {state.result.mode === "ai" && <p className="tg-explanation-mode">AI-prioritized investigation</p>}
                <ul className="tg-detail-list">
                  {state.result.insights?.map((item, index) => (
                    <li key={index}>
                      <strong>{item.kind === "uncertainty" ? "Uncertain" : item.kind === "policy_concern" ? "Policy concern" : "Observation"}</strong>
                      <p>{item.text}</p>
                      {item.evidence_event_ids.map((id) => <EvidenceId key={id} id={id} onInspect={onInspect} />)}
                    </li>
                  ))}
                </ul>
                <h3>GDPR considerations</h3>
                <p>These assessments flag questions for review. The internal policy verdict addresses the scenario’s configured rules.</p>
                {state.result.gdpr_mappings?.length ? (
                  <ul className="tg-detail-list">
                    {state.result.gdpr_mappings.map((item, index) => (
                      <li key={index}>
                        <strong>Article {item.reference.article} · {item.assessment === "potential_concern" ? "Potential concern" : "Insufficient information"}</strong>
                        <p>{item.rationale}</p>
                        <p>{item.reference.criteria}</p>
                        {item.evidence_event_ids.map((id) => <EvidenceId key={id} id={id} onInspect={onInspect} />)}
                        <p>Facts to verify</p>
                        <ul>{item.missing_facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                        <p><a href={item.reference.source_url}>EUR-Lex · {item.reference.title}</a>{" · "}<a href={item.reference.guidance_url}>EDPB guidance</a></p>
                      </li>
                    ))}
                  </ul>
                ) : <p>The available evidence supports no specific GDPR mapping or conclusion about compliance.</p>}
              </>
            )}
            <div className="explain-steps" data-mode={state.result.mode}>
              <h3 className="tg-explanation-mode"><Icon name={fallback ? "index" : "sparkles"} size={16} />
                {fallback ? "Rule-based fallback" : "AI-prioritized next steps"}</h3>
              {state.result.next_steps.length > 0 && <ol className="tg-detail-list" aria-label="Next steps">
                {state.result.next_steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>}
            </div>
          </div>
        )}
        {relatedEvidence}
      </div>
    </section>
  );
}
