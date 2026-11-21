import { useLanguage } from '../../lib/language';
import { EvidenceId } from '../investigation/EvidenceId';
import type { Graph } from './flow-elements';

export function NodeDetails({ graph, selectedNodeId, onSelectNode, onInspect }: {
  graph: Graph;
  onInspect?: (id: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const { t } = useLanguage();
  const node = graph.nodes.find(({ id }) => id === selectedNodeId);
  const edges = graph.edges.filter(({ source, target }) => source === node?.id || target === node?.id);
  return (
    <section className="node-details" aria-label={t("Service evidence")}>
      <h3 id="service-selection">{t("Inspect service evidence")}</h3>
      <div className="evidence-choices" role="group" aria-labelledby="service-selection">
        {[...graph.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(item => (
          <button key={item.id} type="button" aria-label={item.label === item.id ? item.label : item.label + " (" + item.id + ")"} aria-pressed={node?.id === item.id}
            onClick={() => onSelectNode(node?.id === item.id ? '' : item.id)}>
            {item.label}{item.label !== item.id && <small>{item.id}</small>}
          </button>
        ))}
      </div>
      {node && <div key={node.id} className="service-info" aria-live="polite">
        <h3>{node.label}</h3>
        <p>{node.id} · {t(node.kind)}</p>
        <p>{t("Selection identifies a service, not a policy finding.")}</p>
        {edges.length === 0 ? <p>{t("No connected evidence returned.")}</p> : <ul>
          {edges.map((edge) => <li key={edge.id}>
            <strong>{edge.source} → {edge.target}</strong>
            <p>{edge.evidence_status === 'OBSERVED' ? t("Observed transfer") : t("Inferred relationship — unverified")} · {edge.id}</p>
            {edge.evidence_event_ids.length ? <div className="service-ids">{t("Supporting event IDs")}{edge.evidence_event_ids.map(id => <EvidenceId key={id} id={id} onInspect={onInspect} />)}
            </div> : <p>{t("No supporting event IDs returned.")}</p>}
          </li>)}
        </ul>}
      </div>}
    </section>
  );
}
