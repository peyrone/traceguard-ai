import { MarkerType, Position, type Edge, type Node } from '@xyflow/react';

export interface Graph {
  nodes: { id: string; label: string; kind: string }[];
  edges: {
    id: string;
    source: string;
    target: string;
    evidence_status: 'OBSERVED' | 'INFERRED';
    evidence_event_ids: string[];
  }[];
}

export function toFlowElements(graph: Graph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map(({ id, label, kind }, index) => ({
    id,
    data: { label },
    className: kind === 'external' ? 'lineage-node--external' : undefined,
    position: { x: index * 320, y: 0 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const edges: Edge[] = graph.edges.map((edge) => {
    const observed = edge.evidence_status === 'OBSERVED';
    const status = observed ? 'Observed' : 'Inferred';
    const label = [status, ...edge.evidence_event_ids].join(' · ');

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label,
      ariaLabel: label,
      markerEnd: { type: MarkerType.ArrowClosed, color: observed ? '#21675c' : '#725427' },
      className: observed ? 'lineage-edge--observed' : 'lineage-edge--inferred',
    };
  });

  return { nodes, edges };
}
