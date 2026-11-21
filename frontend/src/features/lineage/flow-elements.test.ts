import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toFlowElements, type Graph } from './flow-elements.ts';

test('observed and inferred links keep distinct labels and cite only supplied events', () => {
  const graph: Graph = {
    nodes: [
      { id: 'service-a', label: 'Service A', kind: 'internal' },
      { id: 'service-b', label: 'Service B', kind: 'internal' },
    ],
    edges: [
      {
        id: 'link-1',
        source: 'service-a',
        target: 'service-b',
        evidence_status: 'OBSERVED',
        evidence_event_ids: ['evt-001'],
      },
      {
        id: 'link-2',
        source: 'service-b',
        target: 'service-a',
        evidence_status: 'INFERRED',
        evidence_event_ids: [],
      },
    ],
  };

  const { edges } = toFlowElements(graph);

  assert.deepEqual(
    edges.map(({ source, target, label }) => ({ source, target, label })),
    [
      { source: 'service-a', target: 'service-b', label: 'Observed · evt-001' },
      { source: 'service-b', target: 'service-a', label: 'Inferred' },
    ],
  );
  assert.notEqual(edges[0].className, edges[1].className);
});
