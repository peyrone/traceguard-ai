import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { collectReferences } from '../features/investigation/EvidenceReferences';
import { createApiClient, type Analysis } from '../lib/api/client';

// Exercise app composition without relying on canvas geometry in jsdom.
vi.mock('../features/lineage/LineageGraph', () => ({
  LineageGraph: ({ highlightedEdgeIds }: { highlightedEdgeIds: string[] }) => <div data-testid="highlighted">{highlightedEdgeIds.join(',')}</div>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const analysis: Analysis = {
  summary: { status: 'VERIFIED_VIOLATION', events_processed: 1 },
  graph: {
    nodes: [{ id: 'a', label: 'Service A', kind: 'internal' }, { id: 'b', label: 'Service B', kind: 'external' }],
    edges: [{ id: 'ab', source: 'a', target: 'b', evidence_status: 'OBSERVED', evidence_event_ids: ['evt-003'] }],
  },
  findings: [
    { id: 'finding', rule_id: 'DENY_EXTERNAL_PII', status: 'VERIFIED_VIOLATION', message: 'Synthetic transfer', evidence_event_ids: ['evt-003'], missing_evidence: [] },
    { id: 'unmatched', rule_id: 'UNMATCHED', status: 'INCONCLUSIVE', message: 'Unmatched clue', evidence_event_ids: ['evt-unknown'], missing_evidence: ['link'] },
  ],
};

function mockAPI() {
  const fetch = vi.fn(async (url: string | URL | Request) => ({
    ok: true,
    json: async () => String(url).endsWith('/scenarios')
      ? [{ id: 'one', label: 'Scenario one' }, { id: 'two', label: 'Scenario two' }]
      : String(url).endsWith('/explain')
        ? { explanation: 'Synthetic fallback text', next_steps: [], evidence_event_ids: ['evt-003'], mode: 'fallback' }
        : analysis,
  }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

test('automatic analysis drives highlights and evidence remains inspectable without matching edges', async () => {
  const fetch = mockAPI();
  const user = userEvent.setup();
  render(<App client={createApiClient()} />);
  await screen.findByRole('option', { name: 'Scenario one' });
  expect((await screen.findByTestId('highlighted')).textContent).toBe('ab');
  expect(screen.getByRole('list', { name: 'Related graph edges' }).textContent).toContain('Service A → Service B');
  await user.selectOptions(screen.getByLabelText('Inspect service evidence'), 'a');
  expect(within(screen.getByRole('region', { name: 'Service evidence' })).getByRole('button', { name: 'evt-003' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /UNMATCHED/ }));
  expect(screen.getByTestId('highlighted').textContent).toBe('');
  const evidence = within(screen.getByRole('region', { name: 'Evidence' }));
  expect(evidence.getByRole('button', { name: 'evt-unknown' })).toBeTruthy();
  expect(screen.queryByRole('list', { name: 'Related graph edges' })).toBeNull();
});

test('scenario changes clear service selection and explanation before automatic analysis', async () => {
  const fetch = mockAPI();
  const user = userEvent.setup();
  render(<App client={createApiClient()} />);
  await screen.findByRole('option', { name: 'Scenario one' });
  await screen.findByTestId('highlighted');
  await user.selectOptions(screen.getByLabelText('Inspect service evidence'), 'a');
  await user.click(screen.getByRole('button', { name: 'Explain finding' }));
  await screen.findByText('Synthetic fallback text');
  await user.selectOptions(screen.getByLabelText('Investigation case'), 'two');
  expect(screen.queryByText('Synthetic fallback text')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(4);
  await screen.findByTestId('highlighted');
  expect((screen.getByLabelText('Inspect service evidence') as HTMLSelectElement).value).toBe('');
});

test('API failures stay visible without substituting a preview graph; retry recovers', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal('fetch', fetch);
  render(<App client={createApiClient()} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Offline');
  expect(screen.queryByTestId('highlighted')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Retry case catalog' }));
  await waitFor(() => expect(screen.getByRole('option', { name: 'No cases available' })).toBeTruthy());
  expect(screen.getByText('Synthetic audit data · API mode')).toBeTruthy();
});

test('late analysis from the previous scenario cannot replace current results', async () => {
  let resolveOld!: (response: unknown) => void;
  const oldResponse = new Promise((resolve) => { resolveOld = resolve; });
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/scenarios')) return { ok: true, json: async () => [{ id: 'one', label: 'Scenario one' }, { id: 'two', label: 'Scenario two' }] };
    if (JSON.parse(String(options?.body)).scenario_id === 'one') return oldResponse;
    return { ok: true, json: async () => ({ ...analysis, summary: { status: 'NO_VIOLATION_OBSERVED', events_processed: 7 }, findings: [] }) };
  });
  vi.stubGlobal('fetch', fetch);
  render(<App client={createApiClient()} />);
  await screen.findByText('Analyzing case…');
  await userEvent.selectOptions(screen.getByLabelText('Investigation case'), 'two');
  await screen.findByRole('heading', { name: 'No violation observed' });
  expect(screen.getByRole('status').textContent).toContain('7 events processed');
  resolveOld({ ok: true, json: async () => analysis });
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('No violation observed'));
  expect(screen.getByText('Available events do not prove compliance.')).toBeTruthy();
});

test('the references table lists each cited ID once, including findings without edges', async () => {
  mockAPI();
  render(<App client={createApiClient()} />);
  const region = within(await screen.findByRole('region', { name: 'Evidence references' }));
  expect(region.getAllByRole('row')).toHaveLength(3);
  expect(region.getByRole('button', { name: 'evt-003' })).toBeTruthy();
  expect(region.getByRole('button', { name: 'evt-unknown' })).toBeTruthy();
});

test('the shared reference index retains all associations and includes edge-only IDs', () => {
  const edge = analysis.graph.edges[0];
  const second = { ...edge, id: 'second', evidence_event_ids: ['evt-003', 'evt-003', 'edge-only'] };
  const entries = collectReferences({ ...analysis.graph, edges: [edge, second] }, analysis.findings);
  expect(entries.map(entry => [entry.id, entry.edges.map(item => item.id), entry.findings.map(item => item.id)])).toEqual([
    ['edge-only', ['second'], []],
    ['evt-003', ['ab', 'second'], ['finding']],
    ['evt-unknown', [], ['unmatched']],
  ]);
});

test('an explanation error leaves finding evidence available and can be retried', async () => {
  const fetch = mockAPI();
  const user = userEvent.setup();
  render(<App client={createApiClient()} />);
  const explain = await screen.findByRole('button', { name: 'Explain finding' });
  fetch.mockRejectedValueOnce(new Error('Explanation unavailable'));
  await user.click(explain);
  expect((await screen.findByRole('alert')).textContent).toContain('Explanation unavailable');
  const evidence = within(screen.getByRole('region', { name: 'Evidence' }));
  expect(evidence.getByRole('button', { name: 'evt-003' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Retry explanation' }));
  expect(await screen.findByText('Rule-based fallback')).toBeTruthy();
});

test('link counts and the evidence filter follow the analysis and selected finding', async () => {
  mockAPI();
  const user = userEvent.setup();
  render(<App client={createApiClient()} />);
  const references = within(await screen.findByRole('region', { name: 'Evidence references' }));
  const composition = screen.getByRole('figure', { name: 'Link evidence' });
  expect(composition.textContent).toMatch(/Observed 1/);
  expect(composition.textContent).toMatch(/Inferred 0/);

  await user.click(references.getByRole('button', { name: /Selected finding/ }));
  expect(references.queryByRole('button', { name: 'evt-unknown' })).toBeNull();
  expect(references.getByRole('button', { name: 'evt-003' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /UNMATCHED/ }));
  expect(references.getByRole('button', { name: 'evt-unknown' })).toBeTruthy();
  expect(references.queryByRole('button', { name: 'evt-003' })).toBeNull();
  await user.click(references.getByRole('button', { name: /All references/ }));
  expect(references.getAllByRole('row')).toHaveLength(3);
});

test('catalog refresh preserves the active case on failure and clears removed cases', async () => {
  const fetch = mockAPI();
  const user = userEvent.setup();
  render(<App client={createApiClient()} />);
  const picker = await screen.findByRole('combobox', { name: 'Investigation case' });
  await screen.findByRole('option', { name: 'Scenario two' });
  await user.selectOptions(picker, 'two');
  await screen.findByTestId('highlighted');
  await user.click(screen.getByRole('button', { name: 'Refresh case catalog' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
  expect((picker as HTMLSelectElement).value).toBe('two');
  fetch.mockRejectedValueOnce(new Error('Offline'));
  await user.click(screen.getByRole('button', { name: 'Refresh case catalog' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Showing the last fetched list.');
  expect((picker as HTMLSelectElement).value).toBe('two');
  expect(screen.getByTestId('highlighted')).toBeTruthy();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
  await user.click(screen.getByRole('button', { name: 'Retry case catalog' }));
  await screen.findByRole('option', { name: 'No cases available' });
  expect(screen.queryByTestId('highlighted')).toBeNull();
  expect(screen.queryByText('Analyzing case…')).toBeNull();
});
