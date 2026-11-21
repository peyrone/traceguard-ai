import { Background, Controls, Handle, Position, ReactFlow, type NodeProps } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

import { toFlowElements, type Graph } from './flow-elements';

import '@xyflow/react/dist/style.css';
import './lineage.css';

const fitOptions = { padding: { top: 70, bottom: 18, x: 24 }, maxZoom: 1.1 };

function ServiceNode({ data, sourcePosition, targetPosition }: NodeProps) {
  return <>
    <Handle type="target" position={targetPosition ?? Position.Left} />
    <span className="service-kind">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        {data.kind === 'external' ? <>
          <circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>
        </> : <>
          <rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 7h2m-2 10h2"/>
        </>}
      </svg>
      {String(data.kind)}
    </span>
    <strong>{String(data.name)}</strong>
    <Handle type="source" position={sourcePosition ?? Position.Right} />
  </>;
}

const nodeTypes = { service: ServiceNode };

interface LineageGraphProps {
  graph: Graph;
  selectedFindingId: string | null;
  highlightedEdgeIds?: string[];
  onSelectNode: (id: string) => void;
}

export function LineageGraph({ graph, onSelectNode, highlightedEdgeIds }: LineageGraphProps) {
  const [vertical, setVertical] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 650px)');
    const onChange = () => setVertical(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const { nodes, edges } = useMemo(() => toFlowElements(graph, highlightedEdgeIds, vertical), [graph, highlightedEdgeIds, vertical]);

  if (nodes.length === 0) {
    return <p className="lineage-empty">No services in the available evidence.</p>;
  }

  return (
    <div className="lineage-canvas">
      <ReactFlow
        key={vertical ? "vertical" : "horizontal"}
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        forceColorMode="dark"
        minZoom={0.1}
        fitView
        fitViewOptions={fitOptions}
      >
        <Background bgColor="#241d30" color="#564864" gap={18} />
        <Controls position="top-right" orientation="horizontal" showInteractive={false} fitViewOptions={fitOptions} />
      </ReactFlow>
    </div>
  );
}
