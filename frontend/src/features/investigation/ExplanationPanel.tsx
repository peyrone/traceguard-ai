import { useEffect, useRef, useState } from "react";
import type { ExplainResponse, Finding } from "../../lib/api/types.ts";

export type RequestExplanation = (finding: Finding, signal: AbortSignal) => Promise<ExplainResponse>;

type ExplanationState =
  | { status: "loading" }
  | { status: "ready"; result: ExplainResponse }
  | { status: "error"; message: string };

interface ExplanationContentProps {
  state?: ExplanationState;
  onExplain: () => void;
}

interface ExplanationPanelProps {
  finding: Finding;
  onRequest: RequestExplanation;
}

export function ExplanationPanel({ finding, onRequest }: ExplanationPanelProps) {
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

  return <ExplanationContent state={state} onExplain={explain} />;
}

export function ExplanationContent({ state, onExplain }: ExplanationContentProps) {
  return (
    <section className="tg-investigation-panel" aria-label="Explanation">
      <h2>Explanation</h2>
      <button className="tg-explain-button" type="button" onClick={onExplain} disabled={state?.status === "loading"}>
        {state?.status === "error" ? "Retry explanation" : "Explain finding"}
      </button>
      {state?.status === "loading" && <p role="status">Loading explanation…</p>}
      {state?.status === "error" && <p role="alert">{state.message}</p>}
      {state?.status === "ready" && (
        <div className="tg-explanation-result" aria-live="polite">
          <p className="tg-explanation-mode">{state.result.mode === "ai" ? "AI-assisted explanation" : "Rule-based fallback"}</p>
          <p>{state.result.explanation}</p>
          {state.result.evidence_event_ids.length > 0 && (
            <ul className="tg-event-ids" aria-label="Cited audit events">
              {state.result.evidence_event_ids.map((id) => <li key={id}><code>{id}</code></li>)}
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
    </section>
  );
}
