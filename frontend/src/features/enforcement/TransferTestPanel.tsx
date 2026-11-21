import { useState } from "react";
import { Icon } from "../../components/Icon";
import "./transfer-test.css";
import type { PrivacyDecisionRequest, PrivacyDecisionResponse } from "../../lib/api/types";

const transferCases = [
  { label: "Internal sales transfer", source: "customer-api", destination: "sales-api", category: "PII" },
  { label: "External CRM transfer", source: "sales-api", destination: "external-crm", category: "PII" },
  { label: "Operational case write", source: "case-router", destination: "case-store", category: "INTERNAL" },
];

const policy = { policy_id: "policy-001", purpose: "CUSTOMER_SERVICE" };

interface Props {
  defaultCase?: "internal" | "external";
  decide: (request: PrivacyDecisionRequest, signal?: AbortSignal) => Promise<PrivacyDecisionResponse>;
}

export function TransferTestPanel({ decide, defaultCase = "internal" }: Props) {
  const [selected, setSelected] = useState(defaultCase === "external" ? 1 : 0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PrivacyDecisionResponse>();
  const [error, setError] = useState("");
  const current = transferCases[selected];

  async function testTransfer() {
    setPending(true);
    setError("");
    setResult(undefined);
    try {
      setResult(await decide({
        source_service: current.source, destination_service: current.destination,
        ...policy, data_categories: [current.category],
      }, AbortSignal.timeout(6000)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The privacy decision request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="transfer-enforcement" className="surface transfer-panel" aria-labelledby="transfer-test-title">
      <header className="panel-heading">
        <h2 id="transfer-test-title"><Icon name="shield" />Simulated transfer enforcement</h2>
        <span className="transfer-policy">Policy <code>{policy.policy_id}</code></span>
      </header>
      <div className="transfer-layout">
        <div className="transfer-controls">
          <label htmlFor="privacy-transfer-case">Transfer case</label>
          <select id="privacy-transfer-case" value={selected} disabled={pending} onChange={(event) => {
            setSelected(Number(event.target.value));
            setResult(undefined);
            setError("");
          }}>
            {transferCases.map(({ label }, index) => <option key={label} value={index}>{label}</option>)}
          </select>
          <button className="transfer-submit" type="button" disabled={pending} onClick={() => void testTransfer()}>
            <Icon name={pending ? "refresh" : "route"} size={17} />{pending ? "Checking policy…" : "Test transfer"}
          </button>
        </div>
        <div className="transfer-preview" role="group" aria-label="Transfer details">
          <div className="transfer-path">
            <div><span>Source</span><code>{current.source}</code></div>
            <span className="transfer-connector" aria-hidden="true"><Icon name="route" size={20} /></span>
            <div><span>Destination</span><code>{current.destination}</code></div>
          </div>
          <dl className="transfer-attributes">
            <div><dt>Data category</dt><dd>{current.category}</dd></div>
            <div><dt>Purpose</dt><dd>{policy.purpose}</dd></div>
          </dl>
        </div>
      </div>
      {pending && <p role="status" className="sr-only">Checking transfer policy…</p>}
      {error && <p role="alert" className="transfer-feedback" data-tone="error"><strong>Policy check failed</strong>{error}</p>}
      {result && (
        <div role="status" className="transfer-feedback" data-tone={result.decision}>
          <strong>{result.decision} · {result.transfer_executed ? "Simulation executed" : result.decision === "ALLOW" ? "Simulation did not execute" : "Blocked before execution"}</strong>
          <p>{result.reason}</p>
          <small>Rule <code>{result.rule_id}</code></small>
        </div>
      )}
    </section>
  );
}
