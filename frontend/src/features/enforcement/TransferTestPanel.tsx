import { useState } from "react";
import type { PrivacyDecisionRequest, PrivacyDecisionResponse } from "../../lib/api/types";

const transferCases = [
  { label: "Internal sales transfer", source: "customer-api", destination: "sales-api" },
  { label: "External CRM transfer", source: "sales-api", destination: "external-crm" },
];

interface Props {
  decide: (request: PrivacyDecisionRequest, signal?: AbortSignal) => Promise<PrivacyDecisionResponse>;
}

export function TransferTestPanel({ decide }: Props) {
  const [selected, setSelected] = useState(0);
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
        data_categories: ["PII"], purpose: "CUSTOMER_SERVICE", policy_id: "policy-001",
      }, AbortSignal.timeout(6000)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The privacy decision request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="scenario-controls investigation-panel" aria-labelledby="transfer-test-title">
      <h2 id="transfer-test-title">Simulated transfer enforcement</h2>
      <label htmlFor="privacy-transfer-case">Transfer case</label>
      <select id="privacy-transfer-case" value={selected} disabled={pending} onChange={(event) => {
        setSelected(Number(event.target.value));
        setResult(undefined);
        setError("");
      }}>
        {transferCases.map(({ label }, index) => <option key={label} value={index}>{label}</option>)}
      </select>
      <p><code>{current.source}</code> → <code>{current.destination}</code> · PII · CUSTOMER_SERVICE</p>
      <button type="button" disabled={pending} onClick={() => void testTransfer()}>Test transfer</button>
      {pending && <p role="status">Checking transfer policy…</p>}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <strong>{result.decision} · {result.transfer_executed ? "Simulation executed" : result.decision === "ALLOW" ? "Simulation did not execute" : "Blocked before execution"}</strong>
          <p><code>{result.rule_id}</code> · {result.reason}</p>
        </div>
      )}
    </section>
  );
}
