import { useState } from 'react';

import { LineageGraph } from '../features/lineage/LineageGraph';
import type { Graph } from '../features/lineage/flow-elements';

const demoGraph: Graph = {
  nodes: [
    { id: 'customer-api', label: 'Customer API', kind: 'internal' },
    { id: 'sales-api', label: 'Sales API', kind: 'internal' },
    { id: 'external-crm', label: 'External CRM', kind: 'external' },
  ],
  edges: [
    {
      id: 'upstream-link',
      source: 'customer-api',
      target: 'sales-api',
      evidence_status: 'INFERRED',
      evidence_event_ids: [],
    },
    {
      id: 'external-transfer',
      source: 'sales-api',
      target: 'external-crm',
      evidence_status: 'OBSERVED',
      evidence_event_ids: ['evt-003'],
    },
  ],
};

export default function App() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = demoGraph.nodes.find((node) => node.id === selectedNodeId);

  return (
    <main>
      <header className="app-header">
        <h1>TraceGuard AI</h1>
        <p>Synthetic audit data</p>
      </header>

      <section className="graph-panel" aria-labelledby="graph-title">
        <header className="panel-header">
          <h2 id="graph-title">Service lineage</h2>
          <p>Solid links show observed transfers. Dashed links show inferred relationships.</p>
        </header>
        <LineageGraph
          graph={demoGraph}
          selectedFindingId={null}
          onSelectNode={setSelectedNodeId}
        />
        <footer className="panel-footer" aria-live="polite">
          {selectedNode ? `Selected service: ${selectedNode.label}` : 'Select a service to inspect it.'}
        </footer>
      </section>
    </main>
  );
}
