import type { AnalysisStatus, Finding } from "../../lib/api/types.ts";
import type { LoadState } from "./state.ts";

export const statusLabels: Record<AnalysisStatus, string> = {
  VERIFIED_VIOLATION: "Verified violation",
  POTENTIAL_VIOLATION: "Potential violation",
  INCONCLUSIVE: "Inconclusive",
  NO_VIOLATION_OBSERVED: "No violation observed",
};

interface FindingsPanelProps {
  findings: Finding[];
  onSelectFinding: (id: string) => void;
  selectedFindingId?: string | null;
  state?: LoadState;
}

export function FindingsPanel({
  findings,
  onSelectFinding,
  selectedFindingId,
  state,
}: FindingsPanelProps) {
  let content;
  if (state?.status === "idle") {
    content = <p>Choose a scenario to see findings.</p>;
  } else if (state?.status === "loading") {
    content = <p role="status">Analyzing scenario…</p>;
  } else if (state?.status === "error") {
    content = <p role="alert">{state.message}</p>;
  } else if (findings.length === 0) {
    content = <p>No findings in the available events.</p>;
  } else {
    content = (
      <ul className="tg-finding-list">
        {findings.map((finding) => (
          <li key={finding.id}>
            <button
              type="button"
              aria-pressed={selectedFindingId === finding.id}
              onClick={() => onSelectFinding(finding.id)}
            >
              <strong data-status={finding.status}>{statusLabels[finding.status]}</strong>
              <span>{finding.message}</span>
              <code>{finding.rule_id}</code>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section className="tg-investigation-panel" aria-label="Findings">
      <header className="panel-heading"><h2>Finding details</h2><span>{findings.length} {findings.length === 1 ? "finding" : "findings"}</span></header>
      {content}
    </section>
  );
}
