import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getHighlightedEdgeIds, toFlowElements, type Graph } from './flow-elements.ts';

test('allowed-flow evidence does not pass through an unrelated external service', () => {
  const graph: Graph = {
    nodes: ['customer-api', 'external-crm', 'sales-api'].map((id) => ({ id, label: id, kind: 'internal' })),
    edges: [{ id: 'allowed', source: 'customer-api', target: 'sales-api', evidence_status: 'OBSERVED', evidence_event_ids: ['evt-001'] }],
  };
  const { nodes } = toFlowElements(graph);
  const customer = nodes.find((node) => node.id === 'customer-api')!.position;
  const sales = nodes.find((node) => node.id === 'sales-api')!.position;
  const external = nodes.find((node) => node.id === 'external-crm')!.position;
  assert.ok(sales.x > customer.x);
  assert.ok(external.y !== customer.y || external.x < customer.x || external.x > sales.x);
});

test('finding evidence highlights only matching edges and their endpoints', () => {
  const graph: Graph = {
    nodes: ['a', 'b', 'c'].map((id) => ({ id, label: id, kind: 'internal' })),
    edges: [
      { id: 'ab', source: 'a', target: 'b', evidence_status: 'OBSERVED', evidence_event_ids: ['evt-003'] },
      { id: 'bc', source: 'b', target: 'c', evidence_status: 'INFERRED', evidence_event_ids: [] },
    ],
  };
  assert.deepEqual(getHighlightedEdgeIds(graph, ['unknown']), []);
  assert.deepEqual(getHighlightedEdgeIds(graph, ['evt-003']), ['ab']);
  const flow = toFlowElements(graph, getHighlightedEdgeIds(graph, ['evt-003']));
  assert.deepEqual(flow.nodes.filter((node) => node.selected).map((node) => node.id), ['a', 'b']);
  assert.deepEqual(flow.edges.filter((edge) => edge.selected).map((edge) => edge.id), ['ab']);
});

test('node positions remain stable after input order changes, including cyclic and isolated services', () => {
  const graph: Graph = {
    nodes: ['c', 'b', 'a', 'isolated'].map((id) => ({ id, label: id, kind: 'internal' })),
    edges: [
      { id: 'ab', source: 'a', target: 'b', evidence_status: 'OBSERVED', evidence_event_ids: ['evt-1'] },
      { id: 'ba', source: 'b', target: 'a', evidence_status: 'INFERRED', evidence_event_ids: [] },
    ],
  };
  const positions = (input: Graph) => Object.fromEntries(toFlowElements(input).nodes.map(({ id, position }) => [id, position]));
  assert.deepEqual(positions(graph), positions({ nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() }));
  assert.equal(new Set(Object.values(positions(graph)).map((position) => JSON.stringify(position))).size, graph.nodes.length);
});

test('external services carry an explicit text label', () => {
  const { nodes } = toFlowElements({ nodes: [{ id: 'outside', label: 'Outside', kind: 'external' }], edges: [] });
  assert.match(String(nodes[0].data.label), /External/);
});

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
