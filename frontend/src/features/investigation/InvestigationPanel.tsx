import type { Explanation, Finding, Status } from '../../lib/api/client';

export const statusLabels: Record<Status, string> = {
  VERIFIED_VIOLATION: 'Verified violation',
  POTENTIAL_VIOLATION: 'Potential violation',
  INCONCLUSIVE: 'Inconclusive',
  NO_VIOLATION_OBSERVED: 'No violation observed',
};

interface Props {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string) => void;
  explanation: Explanation | null;
  explanationError: string | null;
  explaining: boolean;
  onExplain: () => void;
}

export function InvestigationPanel(props: Props) {
  const finding = props.findings.find((item) => item.id === props.selectedFindingId);

  return (
    <section className="investigation-panel" aria-labelledby="findings-title">
      <h2 id="findings-title">Findings</h2>
      {props.findings.length === 0 && <p>No findings returned.</p>}
      <ul className="finding-list">
        {props.findings.map((item) => (
          <li key={item.id}>
            <button type="button" aria-pressed={item.id === finding?.id} onClick={() => props.onSelectFinding(item.id)}>
              {statusLabels[item.status]} · {item.rule_id}
            </button>
          </li>
        ))}
      </ul>
      {finding && (
        <div className="finding-detail">
          <p>{finding.message}</p>
          {finding.evidence_event_ids.length > 0 && <p>Evidence: {finding.evidence_event_ids.join(', ')}</p>}
          {finding.missing_evidence.length > 0 && <p>Missing evidence: {finding.missing_evidence.join(', ')}</p>}
          <button type="button" disabled={props.explaining} onClick={props.onExplain}>
            {props.explaining ? 'Requesting explanation…' : 'Explain finding'}
          </button>
          {props.explanationError && <p role="alert">{props.explanationError}</p>}
          {props.explanation && (
            <section aria-label="Explanation" aria-live="polite">
              <h3>Explanation</h3>
              <p>{props.explanation.mode === 'fallback' ? 'Deterministic fallback' : 'AI-assisted next steps'}</p>
              <p>{props.explanation.explanation}</p>
              <ul>{props.explanation.next_steps.map((step) => <li key={step}>{step}</li>)}</ul>
              {props.explanation.evidence_event_ids.length > 0 && (
                <p>Evidence: {props.explanation.evidence_event_ids.join(', ')}</p>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
