import { useEffect, useRef, useState } from 'react';
import type { Finding, Graph, GraphEdge } from '../../lib/api/types';

import { Icon } from '../../components/Icon';
import { FindingStatus } from './FindingStatus';
import { ServiceRoute } from './ServiceRoute';

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

export function EvidenceReferences({ references, graph, selectedFindingId, onInspect }: {
  references: EvidenceReference[];
  graph: Graph;
  selectedFindingId: string | null;
  onInspect: (id: string) => void;
}) {
  const [selectedOnly, setSelectedOnly] = useState(false);
  const labels = new Map(graph.nodes.map(node => [node.id, node.label]));
  const cited = references.filter(item => item.findings.some(finding => finding.id === selectedFindingId));
  const filtered = selectedOnly && selectedFindingId !== null;
  const rows = filtered ? cited : references;
  return <section className="surface references" id="references" aria-labelledby="references-title">
    <header className="panel-heading">
      <h2 id="references-title"><Icon name="index" />Evidence references</h2>
      <div className="reference-scope" role="group" aria-label="Filter evidence references">
        <button type="button" aria-pressed={!filtered} onClick={() => setSelectedOnly(false)}>
          All references <b>{references.length}</b>
        </button>
        <button type="button" disabled={selectedFindingId === null} aria-pressed={filtered} onClick={() => setSelectedOnly(true)}>
          <Icon name="filter" size={15} /> Selected finding <b>{cited.length}</b>
        </button>
      </div>
    </header>
    {rows.length === 0 ? <p className="inset">{filtered ? 'This finding cites no event IDs.' : 'No evidence IDs were returned for this scenario.'}</p> :
      <div className="table-wrap"><table>
        <thead><tr><th>Event ID</th><th>Service links</th><th>Related findings</th></tr></thead>
        <tbody>{rows.map(item => <tr key={item.id}>
          <td><button type="button" className="ref-link" onClick={() => onInspect(item.id)}>{item.id}</button></td>
          <td><span className="mobile-column-label" aria-hidden="true">Service links</span>{item.edges.length === 0 ? <span className="muted">No linked service</span> :
            item.edges.map(edge => <ServiceRoute key={edge.id} edge={edge} labels={labels} />)}</td>
          <td><span className="mobile-column-label" aria-hidden="true">Related findings</span>{item.findings.length === 0 ? <span className="muted">No finding cites this ID</span> :
            item.findings.map(finding => <div className="reference-finding" key={finding.id}>
              <FindingStatus status={finding.status} /><code>{finding.rule_id}</code>
            </div>)}</td>
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
        <li key={edge.id}><ServiceRoute edge={edge} labels={labels} /><code>{edge.id}</code></li>)}</ul>}
      <h3>Related findings</h3>
      {item.findings.length === 0 ? <p>No finding cites this reference.</p> : <ul>{item.findings.map(finding =>
        <li key={finding.id}><code>{finding.rule_id}</code><p>{finding.message}</p></li>)}</ul>}
    </div>
  </dialog>;
}
