import { useLanguage } from '../../lib/language';
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import "./transfer-test.css";
import type { AnalyzeResponse, PrivacyDecisionRequest, PrivacyDecisionResponse } from "../../lib/api/types";

interface Props {
  scenarioID: string;
  analysis: AnalyzeResponse | null;
  loading: boolean;
  decide: (request: PrivacyDecisionRequest, signal?: AbortSignal) => Promise<PrivacyDecisionResponse>;
}

export function TransferTestPanel({ scenarioID, analysis, loading, decide }: Props) {
  const { t } = useLanguage();
  const [selectedID, setSelectedID] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PrivacyDecisionResponse>();
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  const nodes = new Set(analysis?.graph.nodes.map((node) => node.id));
  const edges = new Map(analysis?.graph.edges.map((edge) => [edge.id, edge]));
  const candidates = analysis?.transfer_candidates?.filter((candidate) => {
    const edge = edges.get(candidate.edge_id);
    return nodes.has(candidate.source_service) && nodes.has(candidate.destination_service)
      && edge?.source === candidate.source_service && edge.target === candidate.destination_service
      && edge.evidence_status === candidate.evidence_status
      && candidate.evidence_event_ids.every((id) => edge.evidence_event_ids.includes(id));
  }) ?? [];
  const selected = candidates.find((candidate) => candidate.id === selectedID);

  async function testTransfer() {
    if (!selected || loading || pending || !scenarioID) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError("");
    setResult(undefined);
    try {
      const response = await decide({ scenario_id: scenarioID, candidate_id: selected.id },
        AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]));
      if (!controller.signal.aborted) setResult(response);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "The privacy decision request failed.");
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <section id="transfer-enforcement" className="surface transfer-panel" aria-labelledby="transfer-test-title">
      <header className="transfer-heading">
        <div>
          <h2 id="transfer-test-title"><Icon name="shield" />{t("Simulated transfer enforcement")}</h2>
          {selected && <p className="transfer-policy">{t("Policy")} <code>{selected.policy_id}</code></p>}
        </div>
        <div className="transfer-controls">
          <h3 id="transfer-selection">{t("Scenario transfer")}</h3>
          {candidates.length > 0 && <div className="evidence-choices" role="group" aria-labelledby="transfer-selection">
            {candidates.map(candidate => (
              <button key={candidate.id} type="button" aria-pressed={selectedID === candidate.id} disabled={loading || pending}
                onClick={() => {
                  setSelectedID(selectedID === candidate.id ? "" : candidate.id);
                  setResult(undefined);
                  setError("");
                }}>
                {candidate.source_service} → {candidate.destination_service}
                <small>{t(candidate.evidence_status)} · {candidate.evidence_event_ids.join(", ")}</small>
              </button>
            ))}
          </div>}
          {!loading && candidates.length === 0 && <p>{t("No transfer evidence is available to simulate.")}</p>}
        </div>
      </header>
      <div className="transfer-layout">
        {selected && (
          <div className="transfer-preview" role="group" aria-label={t("Transfer details")}>
            <div className="transfer-path">
              <div><span>{t("Source")}</span><code>{selected.source_service}</code></div>
              <span className="transfer-connector" aria-hidden="true"><Icon name="route" size={20} /></span>
              <div><span>{t("Destination")}</span><code>{selected.destination_service}</code></div>
            </div>
            <dl className="transfer-attributes">
              <div><dt>{t("Data category")}</dt><dd>{selected.classification ?? t("Unknown")}</dd></div>
              <div><dt>{t("Purpose")}</dt><dd>{selected.purpose ?? t("Unknown")}</dd></div>
              <div><dt>{t("Historical evidence")}</dt><dd>{selected.evidence_status === "OBSERVED" ? t("Observed completed send") : t("Inferred relationship")}</dd></div>
              <div><dt>{t("Supporting events")}</dt><dd>{selected.evidence_event_ids.map((id) => <code key={id}>{id} </code>)}</dd></div>
            </dl>
          </div>
        )}
        <button className="transfer-submit" type="button" disabled={loading || pending || !selected || !scenarioID} onClick={() => void testTransfer()}>
          <Icon name={pending ? "refresh" : "route"} size={17} />{pending ? t("Checking policy…") : t("Test transfer")}
        </button>
      </div>
      {pending && <p role="status" className="sr-only">{t("Checking transfer policy…")}</p>}
      {error && <p role="alert" className="transfer-feedback" data-tone="error"><strong>{t("Policy check failed")}</strong>{t(error)}</p>}
      {result && (
        <div role="status" className="transfer-feedback" data-tone={result.decision}>
          <strong>{result.decision} · {result.transfer_executed ? t("Simulation executed") : result.decision === "ALLOW" ? t("Simulation did not execute") : t("Blocked before execution")}</strong>
          <p>{result.reason}</p>
          <small>{t("Rule")} <code>{result.rule_id}</code></small>
        </div>
      )}
    </section>
  );
}
