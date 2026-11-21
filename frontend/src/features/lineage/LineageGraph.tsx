import { useLanguage } from '../../lib/language';
import { Background, Controls, Handle, Position, ReactFlow, type NodeProps } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

import { EvidenceDialog } from '../investigation/EvidenceReferences';
import { EvidenceId } from '../investigation/EvidenceId';
import { ServiceRoute } from '../investigation/ServiceRoute';
import { toFlowElements, type Graph } from './flow-elements';

import '@xyflow/react/dist/style.css';
import './lineage.css';

const fitOptions = { padding: { top: 70, bottom: 18, x: 24 }, maxZoom: 1.1 };

function ServiceNode({ data, sourcePosition, targetPosition }: NodeProps) {
  const { t } = useLanguage();
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
      {t(String(data.kind))}
    </span>
    <strong>{String(data.name)}</strong>
    <Handle type="source" position={sourcePosition ?? Position.Right} />
  </>;
}

const nodeTypes = { service: ServiceNode };

interface LineageGraphProps {
  graph: Graph;
  onInspect: (eventId: string) => void;
  highlightedEdgeIds?: string[];
  onSelectNode: (id: string) => void;
}

export function LineageGraph({ graph, onSelectNode, onInspect, highlightedEdgeIds }: LineageGraphProps) {
  const { t } = useLanguage();
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const selectedEdge = graph.edges.find(edge => edge.id === edgeId);
  const [vertical, setVertical] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 650px)');
    const onChange = () => setVertical(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const { nodes, edges } = useMemo(() => {
    const elements = toFlowElements(graph, highlightedEdgeIds, vertical, t);
    for (const edge of elements.edges) {
      edge.ariaRole = 'button';
      edge.domAttributes = {
        'aria-haspopup': 'dialog',
        onKeyDownCapture(event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            setEdgeId(edge.id);
          }
        },
      };
    }
    return elements;
  }, [graph, highlightedEdgeIds, vertical, t]);

  if (nodes.length === 0) {
    return <p className="lineage-empty">{t("No services in the available evidence.")}</p>;
  }

  return (
    <div className="lineage-canvas">
      <ReactFlow
        key={vertical ? "vertical" : "horizontal"}
        ariaLabelConfig={{
          'controls.ariaLabel': t('Control Panel'),
          'controls.zoomIn.ariaLabel': t('Zoom In'),
          'controls.zoomOut.ariaLabel': t('Zoom Out'),
          'controls.fitView.ariaLabel': t('Fit View'),
        }}
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onEdgeClick={(_, edge) => setEdgeId(edge.id)}
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
      {selectedEdge && <EvidenceDialog title={t("Transfer evidence")} onClose={() => setEdgeId(null)}>
        <ServiceRoute edge={selectedEdge} labels={new Map(graph.nodes.map(node => [node.id, node.label]))} />
        <h3>{t("Supporting event IDs")}</h3>
        {selectedEdge.evidence_event_ids.length ? <div className="service-ids">
          {[...new Set(selectedEdge.evidence_event_ids)].map(id => <EvidenceId key={id} id={id} onInspect={eventId => {
            setEdgeId(null);
            onInspect(eventId);
          }} />)}
        </div> : <p>{t("No supporting event IDs returned.")}</p>}
      </EvidenceDialog>}
    </div>
  );
}
