import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import type { EvidenceDialog } from '../features/investigation/EvidenceReferences';
import type { Edge } from '@xyflow/react';
import { LineageGraph } from '../features/lineage/LineageGraph';
import type { Graph } from '../lib/api/types';

// jsdom cannot lay out the canvas. Keep the edge callbacks and focus targets from the real graph.
vi.mock('@xyflow/react', async importOriginal => ({
  ...await importOriginal<typeof import('@xyflow/react')>(),
  ReactFlow: ({ edges, onEdgeClick }: { edges: Edge[]; onEdgeClick: (event: unknown, edge: Edge) => void }) =>
    <svg>{edges.map(edge => <g key={edge.id} role={edge.ariaRole} aria-label={edge.id} tabIndex={0}
      onClick={event => onEdgeClick(event, edge)} {...edge.domAttributes} />)}</svg>,
}));

// Native modal opening and focus restoration are exercised in the browser.
vi.mock('../features/investigation/EvidenceReferences', () => ({
  EvidenceDialog: ({ title, children }: ComponentProps<typeof EvidenceDialog>) =>
    <dialog open aria-label={title}>{children}</dialog>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('each graph edge opens only its own evidence, including uncited links', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const graph: Graph = {
    nodes: [{ id: 'a', label: 'A', kind: 'internal' }, { id: 'b', label: 'B', kind: 'external' }],
    edges: [
      { id: 'forward', source: 'a', target: 'b', evidence_status: 'OBSERVED', evidence_event_ids: ['evt-a', 'evt-b'] },
      { id: 'backward', source: 'b', target: 'a', evidence_status: 'INFERRED', evidence_event_ids: [] },
    ],
  };
  const onInspect = vi.fn();
  const user = userEvent.setup();
  render(<LineageGraph graph={graph} onSelectNode={() => {}} onInspect={onInspect} />);
  await user.click(screen.getByRole('button', { name: 'forward' }));
  const evidence = within(screen.getByRole('dialog', { name: 'Transfer evidence' }));
  expect(evidence.getByText('Observed transfer')).toBeTruthy();
  expect(evidence.getByRole('button', { name: 'evt-a' })).toBeTruthy();
  await user.click(evidence.getByRole('button', { name: 'evt-b' }));
  expect(onInspect).toHaveBeenCalledWith('evt-b');
  screen.getByRole('button', { name: 'backward' }).focus();
  await user.keyboard('{Enter}');
  const inferred = within(screen.getByRole('dialog'));
  expect(inferred.getByText('Inferred link')).toBeTruthy();
  expect(inferred.getByText('No supporting event IDs returned.')).toBeTruthy();
  expect(inferred.queryByRole('button', { name: /evt-/ })).toBeNull();
});
