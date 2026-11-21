import { ServiceRoute } from "./ServiceRoute";
import { EvidenceId } from "./EvidenceId";
import type { Finding, Graph } from "../../lib/api/types.ts";

interface EvidencePanelProps {
  finding: Finding | null;
  graph?: Graph;
  onInspect?: (id: string) => void;
}

export function EvidencePanel({ finding, graph, onInspect }: EvidencePanelProps) {
  const eventIds = new Set(finding?.evidence_event_ids);
  const relatedEdges = graph?.edges.filter((edge) =>
    edge.evidence_event_ids.some((id) => eventIds.has(id)),
  ) ?? [];
  const nodeLabels = new Map(graph?.nodes.map(({ id, label }) => [id, label]));

  return (
    <section className="tg-investigation-panel" aria-label="Evidence">
      <h3>Supporting evidence</h3>
      {finding === null ? <p>Select a finding to view its evidence.</p> : (
        <>
          {eventIds.size === 0 ? <p>No event IDs support this finding.</p> : (
            <ul className="tg-event-ids" aria-label="Referenced audit events">
              {Array.from(eventIds, (id) => <li key={id}><EvidenceId id={id} onInspect={onInspect} /></li>)}
            </ul>
          )}
          {relatedEdges.length > 0 && (
            <ul className="tg-evidence-edges" aria-label="Related graph edges">
              {relatedEdges.map((edge) => (
                <li key={edge.id}>
                  <ServiceRoute edge={edge} labels={nodeLabels} />
                </li>
              ))}
            </ul>
          )}
          {finding.missing_evidence.length > 0 && (
            <>
              <h3>Missing evidence</h3>
              <ul className="tg-detail-list">
                {finding.missing_evidence.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
