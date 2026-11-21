import { useEffect, useRef } from 'react';
import type { Finding, Graph, GraphEdge } from '../../lib/api/types';

export interface EvidenceReference {
  id: string;
  edges: GraphEdge[];
  findings: Finding[];
}

export function collectReferences(graph: Graph, findings: Finding[]) {
  const references = new Map<string, EvidenceReference>();
  function reference(id: string) {
    const existing = references.get(id);
    if (existing) return existing;
    const entry: EvidenceReference = { id, edges: [], findings: [] };
    references.set(id, entry);
    return entry;
  }
  for (const edge of graph.edges) {
    for (const id of new Set(edge.evidence_event_ids)) reference(id).edges.push(edge);
  }
  for (const finding of findings) {
    for (const id of new Set(finding.evidence_event_ids)) reference(id).findings.push(finding);
  }
  return [...references.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function EvidenceReferences({ references, onInspect }: {
  references: EvidenceReference[];
  onInspect: (id: string) => void;
}) {
  return <section className="surface references" id="references" aria-labelledby="references-title">
    <header className="panel-heading"><h2 id="references-title">Evidence references</h2>
      <span>{references.length} unique {references.length === 1 ? 'ID' : 'IDs'}</span></header>
    {references.length === 0 ? <p className="inset">No evidence IDs were returned for this scenario.</p> :
      <div className="table-wrap"><table>
        <thead><tr><th>Event ID</th><th>Service links</th><th>Related findings</th></tr></thead>
        <tbody>{references.map(item => <tr key={item.id}>
          <td><button type="button" className="ref-link" onClick={() => onInspect(item.id)}>{item.id}</button></td>
          <td>{item.edges.length}</td><td>{item.findings.length}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

export function ReferenceDialog({ item, graph, onClose }: {
  item: EvidenceReference;
  graph: Graph;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  const labels = new Map(graph.nodes.map(node => [node.id, node.label]));
  return <dialog ref={dialog} aria-labelledby="reference-title" onClose={event => {
    if (!event.currentTarget.open) onClose();
  }}>
    <header className="panel-heading"><h2 id="reference-title">Evidence reference</h2>
      <button type="button" aria-label="Close evidence details" onClick={() => dialog.current?.close()}>Close</button></header>
    <div className="inset dialog-body"><code>{item.id}</code><h3>Service links</h3>
      {item.edges.length === 0 ? <p>No related service link was returned.</p> : <ul>{item.edges.map(edge =>
        <li key={edge.id}><strong>{labels.get(edge.source) ?? edge.source} → {labels.get(edge.target) ?? edge.target}</strong>
          <p>{edge.evidence_status === 'OBSERVED' ? 'Observed transfer' : 'Inferred link'} · <code>{edge.id}</code></p></li>)}</ul>}
      <h3>Related findings</h3>
      {item.findings.length === 0 ? <p>No finding cites this reference.</p> : <ul>{item.findings.map(finding =>
        <li key={finding.id}><code>{finding.rule_id}</code><p>{finding.message}</p></li>)}</ul>}
    </div>
  </dialog>;
}
