import { Background, Controls, ReactFlow } from '@xyflow/react';
import { useMemo } from 'react';

import { toFlowElements, type Graph } from './flow-elements';

import '@xyflow/react/dist/style.css';
import './lineage.css';

interface LineageGraphProps {
  graph: Graph;
  selectedFindingId: string | null;
  highlightedEdgeIds?: string[];
  onSelectNode: (id: string) => void;
}

export function LineageGraph({ graph, onSelectNode, highlightedEdgeIds }: LineageGraphProps) {
  const { nodes, edges } = useMemo(() => toFlowElements(graph, highlightedEdgeIds), [graph, highlightedEdgeIds]);

  if (nodes.length === 0) {
    return <p className="lineage-empty">No services in the available evidence.</p>;
  }

  return (
    <div className="lineage-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        forceColorMode="light"
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.1 }}
      >
        <Background color="#acbdc5" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
