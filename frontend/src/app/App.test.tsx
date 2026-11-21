import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type { Analysis } from '../lib/api/client';

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
  render(<App />);
  await screen.findByRole('option', { name: 'Scenario one' });
  expect((await screen.findByTestId('highlighted')).textContent).toBe('ab');
  await user.selectOptions(screen.getByLabelText('Inspect service evidence'), 'a');
  expect(screen.getByText('Supporting event IDs: evt-003')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /UNMATCHED/ }));
  expect(screen.getByTestId('highlighted').textContent).toBe('');
  expect(screen.getByText('Evidence: evt-unknown')).toBeTruthy();
});

test('scenario changes clear service selection and explanation before automatic analysis', async () => {
  const fetch = mockAPI();
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('option', { name: 'Scenario one' });
  await screen.findByTestId('highlighted');
  await user.selectOptions(screen.getByLabelText('Inspect service evidence'), 'a');
  await user.click(screen.getByRole('button', { name: 'Explain finding' }));
  await screen.findByText('Synthetic fallback text');
  await user.selectOptions(screen.getByLabelText('Scenario'), 'two');
  expect(screen.queryByText('Synthetic fallback text')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(4);
  await screen.findByTestId('highlighted');
  expect((screen.getByLabelText('Inspect service evidence') as HTMLSelectElement).value).toBe('');
});

test('API failures stay visible without substituting a preview graph; retry recovers', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toContain('Offline');
  expect(screen.queryByTestId('highlighted')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Retry scenarios' }));
  await waitFor(() => expect(screen.getByText('No scenarios are available.')).toBeTruthy());
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
  render(<App />);
  await screen.findByText('Analyzing scenario…');
  await userEvent.selectOptions(screen.getByLabelText('Scenario'), 'two');
  await screen.findByText('No violation observed · 7 events processed');
  resolveOld({ ok: true, json: async () => analysis });
  await waitFor(() => expect(screen.queryByText('Verified violation · 1 events processed')).toBeNull());
  expect(screen.getByText('Available events do not prove compliance.')).toBeTruthy();
});
