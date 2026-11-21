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

export function getHighlightedEdgeIds(graph: Graph, evidenceEventIds: readonly string[]): string[] {
  const evidence = new Set(evidenceEventIds);
  return graph.edges.filter((edge) => edge.evidence_event_ids.some((id) => evidence.has(id))).map((edge) => edge.id).sort();
}

export function toFlowElements(graph: Graph, highlightedEdgeIds: readonly string[] = [], vertical = false): { nodes: Node[]; edges: Edge[] } {
  const highlighted = new Set(highlightedEdgeIds);
  const endpoints = new Set(graph.edges.filter((edge) => highlighted.has(edge.id)).flatMap((edge) => [edge.source, edge.target]));
  const ordered = [...graph.nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const incoming = new Map(ordered.map(({ id }) => [id, 0]));
  const outgoing = new Map(ordered.map(({ id }) => [id, [] as string[]]));
  for (const edge of graph.edges) {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) continue;
    incoming.set(edge.target, incoming.get(edge.target)! + 1);
    outgoing.get(edge.source)!.push(edge.target);
  }
  const columns = new Map(ordered.map(({ id }) => [id, 0]));
  const queue = ordered.filter(({ id }) => incoming.get(id) === 0).map(({ id }) => id);
  while (queue.length) {
    const id = queue.shift()!;
    for (const target of outgoing.get(id)!.sort()) {
      columns.set(target, Math.max(columns.get(target)!, columns.get(id)! + 1));
      incoming.set(target, incoming.get(target)! - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
    queue.sort();
  }
  // Cyclic components use separate rows rather than claiming a causal order.
  for (const { id } of ordered) if (incoming.get(id)! > 0) columns.set(id, 0);
  const rows = new Map<number, number>();
  const nodes: Node[] = ordered.map(({ id, label, kind }) => {
    const column = columns.get(id)!;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return {
      id,
      selected: endpoints.has(id),
      type: 'service',
      data: { name: label, kind, label: kind === 'external' ? `${label} · External` : label },
      className: kind === 'external' ? 'lineage-node--external' : undefined,
      position: vertical
        ? { x: row * 215 + (column % 2) * 40, y: column * 140 }
        : { x: column * 310, y: row * 180 - column * 48 },
      sourcePosition: vertical ? Position.Bottom : Position.Right,
      targetPosition: vertical ? Position.Top : Position.Left,
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => {
    const observed = edge.evidence_status === 'OBSERVED';
    const status = observed ? 'Observed' : 'Inferred';
    const label = [status, ...edge.evidence_event_ids].join(' · ');

    return {
      id: edge.id,
      selected: highlighted.has(edge.id),
      source: edge.source,
      target: edge.target,
      label,
      ariaLabel: label,
      markerEnd: { type: MarkerType.ArrowClosed, color: highlighted.has(edge.id) ? '#e3c9ff' : '#b4a7c6' },
      className: observed ? 'lineage-edge--observed' : 'lineage-edge--inferred',
    };
  });

  return { nodes, edges };
}
