import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { collectReferences } from '../features/investigation/EvidenceReferences';
import { createApiClient, type Analysis } from '../lib/api/client';

// Exercise app composition without relying on canvas geometry in jsdom.
vi.mock('../features/lineage/LineageGraph', () => ({
  LineageGraph: ({ highlightedEdgeIds }: { highlightedEdgeIds: string[] }) => <div data-testid="highlighted">{highlightedEdgeIds.join(',')}</div>,
}));

beforeEach(() => { window.history.replaceState(null, '', '#workspace?case=one'); });

async function navigateToCase(id: string) {
  await act(async () => {
    window.history.pushState(null, '', '#workspace?case=' + id);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

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
  expect((await screen.findByTestId('highlighted')).textContent).toBe('ab');
  expect(screen.getByRole('list', { name: 'Related graph edges' }).textContent).toContain('Service A → Service B');
  await user.click(screen.getByRole('button', { name: 'Service A (a)' }));
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
  await screen.findByTestId('highlighted');
  await user.click(screen.getByRole('button', { name: 'Service A (a)' }));
  await user.click(screen.getByRole('button', { name: 'Explain finding' }));
  await screen.findByText('Synthetic fallback text');
  await navigateToCase('two');
  expect(screen.queryByText('Synthetic fallback text')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(4);
  await screen.findByTestId('highlighted');
  expect(within(screen.getByRole('group', { name: 'Inspect service evidence' })).queryByRole('button', { pressed: true })).toBeNull();
});

test('API failures stay visible without substituting a preview graph; retry recovers', async () => {
  window.history.replaceState(null, '', '/');
  const fetch = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal('fetch', fetch);
  render(<App client={createApiClient()} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Offline');
  expect(screen.queryByTestId('highlighted')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh cases' }));
  await screen.findByText('No cases in the catalog.');
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
  await screen.findByText('Retrieving case analysis…');
  await navigateToCase('two');
  await screen.findByRole('heading', { name: 'No violation observed' });
  expect(screen.getByRole('status').textContent).toContain('7 events processed');
  resolveOld({ ok: true, json: async () => analysis });
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('No violation observed'));
  expect(screen.getByText('Available events do not prove compliance.')).toBeTruthy();
});

test('changing case during the 500 ms reveal delay discards the previous result', async () => {
  vi.useFakeTimers();
  try {
    mockAPI();
    const client = createApiClient();
    const analyze = vi.fn(async () => analysis);
    await act(async () => { render(<App client={{ ...client, analyze }} />); });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(screen.queryByTestId('highlighted')).toBeNull();

    await navigateToCase('two');
    expect(analyze.mock.calls).toHaveLength(2);
    await act(() => vi.advanceTimersByTimeAsync(499));
    expect(screen.getByText('Retrieving case analysis…')).toBeTruthy();
    expect(screen.queryByTestId('highlighted')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByTestId('highlighted')).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

test('case loading follows the selected request through an error and retry', async () => {
  mockAPI();
  const client = createApiClient();
  const analyze = vi.fn(client.analyze);
  render(<App client={{ ...client, analyze }} />);
  await screen.findByTestId('highlighted');

  let fail!: (error: Error) => void;
  analyze.mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
  const user = userEvent.setup();
  await navigateToCase('two');
  const result = within(screen.getByRole('region', { name: 'Analysis result' }));
  const pending = within(result.getByRole('status'));
  expect(pending.getByText('Retrieving case analysis…')).toBeTruthy();
  expect(pending.getByText('Scenario two')).toBeTruthy();
  expect(screen.queryByTestId('highlighted')).toBeNull();
  fail(new Error('Offline'));
  expect((await result.findByRole('alert')).textContent).toContain('Offline');
  expect(result.queryByRole('status')).toBeNull();

  let finish!: (result: Analysis) => void;
  analyze.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await user.click(result.getByRole('button', { name: 'Retry analysis' }));
  expect(result.getByRole('status').textContent).toContain('Scenario two');
  finish(analysis);
  await screen.findByTestId('highlighted');
  expect(result.queryByText('Retrieving case analysis…')).toBeNull();
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
  expect(explain.getAttribute('aria-describedby')).toBe(screen.getByText('AI-assisted investigation').id);
  fetch.mockRejectedValueOnce(new Error('Explanation unavailable'));
  await user.click(explain);
  expect((await screen.findByRole('alert')).textContent).toContain('Explanation unavailable');
  const evidence = within(screen.getByRole('region', { name: 'Evidence' }));
  expect(evidence.getByRole('button', { name: 'evt-003' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Retry explanation' }));
  expect(await screen.findByRole('heading', { name: 'Rule-based fallback' })).toBeTruthy();
  expect(screen.getByText('Rule-based next steps')).toBeTruthy();
  expect(screen.queryByText('AI-assisted investigation')).toBeNull();
  const rim = screen.getByRole('region', { name: 'Explanation' }).querySelector('.explain-rim');
  expect(rim?.getAttribute('data-muted')).toBe('true');
  await user.click(explain);
  await user.click(explain);
  expect(screen.getByRole('region', { name: 'Explanation' }).querySelector('.explain-rim')).toBe(rim);
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

test('dashboard refresh keeps the last catalog on failure and removes missing cases on recovery', async () => {
  window.history.replaceState(null, '', '/');
  const fetch = mockAPI();
  const user = userEvent.setup();
  render(<App client={createApiClient()} />);
  await screen.findByRole('link', { name: 'Open case Scenario two' });
  fetch.mockRejectedValueOnce(new Error('Offline'));
  await user.click(screen.getByRole('button', { name: 'Refresh cases' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Showing the last fetched list.');
  expect(screen.getByRole('link', { name: 'Open case Scenario two' })).toBeTruthy();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
  await user.click(screen.getByRole('button', { name: 'Refresh cases' }));
  await screen.findByText('No cases in the catalog.');
  expect(screen.queryByRole('link', { name: 'Open case Scenario two' })).toBeNull();
});

test('the explanation separates an observed export from inferred upstream evidence', async () => {
  window.history.replaceState(null, '', '#workspace?case=partial');
  const fixture: Analysis = {
    ...analysis,
    graph: {
      ...analysis.graph,
      nodes: [...analysis.graph.nodes, { id: 'origin', label: 'Origin', kind: 'internal' }],
      edges: [...analysis.graph.edges, {
        id: 'upstream', source: 'origin', target: 'a', evidence_status: 'INFERRED',
        evidence_event_ids: ['evt-upstream'],
      }],
    },
    findings: [
      { ...analysis.findings[1], evidence_event_ids: ['evt-upstream'] },
      analysis.findings[0],
    ],
  };
  const fetch = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.endsWith('/scenarios') ? [{ id: 'partial', label: 'Partial evidence' }]
      : url.endsWith('/explain') ? { explanation: 'Completed export', next_steps: ['Review export'], evidence_event_ids: ['evt-003'], mode: 'ai' }
      : fixture,
  }));
  vi.stubGlobal('fetch', fetch);
  render(<App client={createApiClient()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Explain finding' }));
  const explanationPanel = screen.getByRole('region', { name: 'Explanation' });
  await waitFor(() => expect(explanationPanel.textContent).toContain('AI-prioritized next steps'));
  expect(explanationPanel.querySelector('.explain-rim')?.getAttribute('aria-hidden')).toBe('true');
  expect(explanationPanel.textContent).toContain('DENY_EXTERNAL_PII');
  expect(screen.getByRole('list', { name: 'Cited audit events' }).textContent).toBe('evt-003');
  const upstream = screen.getByRole('region', { name: 'Separate upstream finding' });
  expect(upstream.textContent).toContain('Inconclusive');
  expect(upstream.textContent).toContain('Origin → Service A');
  expect(upstream.textContent).toContain('evt-upstream');
  expect(upstream.textContent).not.toContain('evt-003');
});

test('a late explanation cannot render after changing scenarios', async () => {
  const user = userEvent.setup();
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => { finish = resolve; });
  const baseFetch = mockAPI();
  const fetch = vi.fn((url: string | URL | Request, options?: RequestInit) =>
    String(url).endsWith('/explain') ? pending : baseFetch(url));
  vi.stubGlobal('fetch', fetch);
  render(<App client={createApiClient()} />);
  await user.click(await screen.findByRole('button', { name: 'Explain finding' }));
  await navigateToCase('two');
  await screen.findByRole('button', { name: 'Explain finding' });
  const request = fetch.mock.calls.find(([url]) => String(url).endsWith('/explain'));
  expect(request?.[1]?.signal?.aborted).toBe(true);
  finish(Response.json({ explanation: 'Stale explanation', next_steps: [], evidence_event_ids: ['evt-003'], mode: 'ai' }));
  await pending;
  expect(screen.queryByText('Stale explanation')).toBeNull();
});

test('transfer selection is scoped to the scenario and stale responses are discarded', async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => { finish = resolve; });
  const external = {
    id: 'two/a-b/evt-003', edge_id: 'ab', source_service: 'a', destination_service: 'b',
    evidence_status: 'OBSERVED', evidence_event_ids: ['evt-003'],
    classification: 'PII', purpose: 'MARKETING', policy_id: 'policy-two',
  };
  const forbidden = { ...external, id: 'two/foreign', destination_service: 'external-crm' };
  let attempts = 0;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/scenarios')) return Response.json([{ id: 'one', label: 'First' }, { id: 'two', label: 'Second' }]);
    if (url.endsWith('/privacy/decisions')) {
      attempts++;
      if (attempts === 2) return pending;
      return Response.json({ decision: 'DENY', transfer_executed: false, reason: 'Original purpose denied.', rule_id: 'DENY_PURPOSE' });
    }
    const { scenario_id } = JSON.parse(String(init?.body));
    return Response.json({ ...analysis, transfer_candidates: scenario_id === 'two' ? [external, forbidden] : [] });
  });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  render(<App client={createApiClient()} />);
  const button = () => screen.getByRole('button', { name: 'Test transfer' }) as HTMLButtonElement;
  const transfer = () => screen.getByRole('group', { name: 'Scenario transfer' });
  await screen.findByText('No transfer evidence is available to simulate.');
  expect(button().disabled).toBe(true);

  await navigateToCase('two');
  const candidate = await screen.findByRole('button', { name: /a → b/ });
  expect(within(transfer()).getAllByRole('button')).toEqual([candidate]);
  expect(button().disabled).toBe(true);
  await user.click(candidate);
  const details = within(screen.getByRole('group', { name: 'Transfer details' }));
  for (const value of ['a', 'b', 'PII', 'MARKETING', 'evt-003']) expect(details.getByText(value)).toBeTruthy();
  expect(screen.getByText('policy-two')).toBeTruthy();
  await user.click(button());
  expect(await screen.findByText('DENY · Blocked before execution')).toBeTruthy();
  expect(screen.getByText(/Original purpose denied/)).toBeTruthy();
  const posted = () => fetch.mock.calls.filter(([url]) => url.endsWith('/privacy/decisions'));
  expect(JSON.parse(String(posted()[0][1]?.body))).toEqual({ scenario_id: 'two', candidate_id: external.id });

  await user.click(button());
  await navigateToCase('one');
  await screen.findByText('No transfer evidence is available to simulate.');
  expect(button().disabled).toBe(true);
  expect(screen.queryByRole('group', { name: 'Scenario transfer' })).toBeNull();
  expect(posted()[1][1]?.signal?.aborted).toBe(true);
  finish(Response.json({ decision: 'DENY', transfer_executed: false, reason: 'Stale transfer', rule_id: 'DENY_PURPOSE' }));
  await pending;
  expect(screen.queryByText(/Stale transfer|Original purpose denied/)).toBeNull();
});

test('dashboard prioritizes verified cases and opens the selected case in its report', async () => {
  window.history.replaceState(null, '', '/');
  const client = createApiClient();
  const user = userEvent.setup();
  const explain = vi.fn(async () => ({
    explanation: 'The send event confirms the transfer.', evidence_event_ids: ['evt-003'],
    mode: 'fallback' as const, next_steps: ['Review the destination.'],
  }));
  render(<App client={{ ...client, listScenarios: async () => [{ id: 'clear', label: 'Internal case' }, { id: 'leak', label: 'Export case' }],
    analyze: async id => id === 'clear' ? {
      ...analysis,
      summary: { status: 'NO_VIOLATION_OBSERVED', events_processed: 1 },
      graph: { ...analysis.graph, edges: [{ ...analysis.graph.edges[0], evidence_event_ids: ['evt-001'] }] },
      findings: [],
    } : { ...analysis, findings: [analysis.findings[0]] },
    explain }} />);
  await screen.findByRole('heading', { name: 'Dashboard' });
  const open = await screen.findByRole('link', { name: 'Open case Export case' });
  expect(screen.getByRole('heading', { name: 'evt-003' })).toBeTruthy();
  expect(within(screen.getByRole('banner', { name: 'Application' })).getAllByRole('link')).toHaveLength(1);
  const distribution = within(screen.getByRole('figure', { name: 'Case status distribution' }));
  expect(distribution.getAllByText('50%')).toHaveLength(2);
  const evidence = within(screen.getByRole('figure', { name: 'Evidence links by case' }));
  expect(evidence.getByRole('link', { name: 'Export case' }).getAttribute('href')).toBe('#workspace?case=leak');
  expect(evidence.getAllByTitle('1 observed, 0 inferred')).toHaveLength(2);
  expect(screen.queryByRole('link', { name: 'Open case Internal case' })).toBeNull();
  await user.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('heading', { name: 'evt-001' })).toBeTruthy();
  expect(screen.getAllByRole('link', { name: /Open case/ })[0]).toBe(open);
  expect(screen.getByRole('link', { name: 'View report for Export case' }).getAttribute('href')).toBe('#report?case=leak');
  await user.click(open);
  await screen.findByRole('heading', { name: 'Verified violation' });
  expect(window.location.hash).toBe('#workspace?case=leak');
  expect(screen.queryByRole('combobox')).toBeNull();
  await user.click(screen.getByRole('link', { name: 'View report' }));
  const report = within(await screen.findByRole('article', { name: 'Case report' }));
  expect(report.getByRole('heading', { name: 'Export case' })).toBeTruthy();
  expect(await report.findByText('The send event confirms the transfer.')).toBeTruthy();
  expect(report.getByText('Rule-based next steps')).toBeTruthy();
  expect(report.getByText(/Observed transfer/)).toBeTruthy();
  expect((report.getByRole('button', { name: 'Print / Save PDF' }) as HTMLButtonElement).disabled).toBe(false);
  expect(window.location.hash).toBe('#report?case=leak');
  expect(screen.queryByRole('combobox')).toBeNull();
  await user.click(screen.getByRole('link', { name: /Back to dashboard/ }));
  await user.click(await screen.findByRole('link', { name: 'View report for Export case' }));
  expect(await screen.findByRole('article', { name: 'Case report' })).toBeTruthy();
});

test('dashboard keeps cited audit cards collapsed until requested', async () => {
  window.history.replaceState(null, '', '/');
  const client = createApiClient();
  render(<App client={{
    ...client,
    listScenarios: async () => [{ id: 'partial_evidence_confirmed', label: 'Partial evidence' }],
    analyze: async () => ({
      ...analysis,
      findings: [{ ...analysis.findings[0], evidence_event_ids: ['evt-e-002', 'evt-a-001'] }],
    }),
  }} />);
  await screen.findByRole('heading', { name: 'evt-e-002, evt-a-001' });
  const toggle = screen.getByText('Audit details');
  const details = toggle.closest('details');
  expect(details?.open).toBe(false);
  await userEvent.click(toggle);
  expect(details?.open).toBe(true);
  const record = within(screen.getByRole('group', { name: 'Audit event evt-e-002' }));
  const timestamp = record.getByText('21 Nov 2026, 03:10:03');
  expect(timestamp.getAttribute('datetime')).toBe('2026-11-21T03:10:03Z');
  expect(record.getAllByRole('term').map(term => term.textContent)).toEqual([
    'Occurred at (UTC)', 'Event ID', 'Service', 'Action', 'Outcome', 'Trace ID',
  ]);
  expect(record.getAllByRole('definition').map(definition => definition.textContent)).toEqual([
    '21 Nov 2026, 03:10:03', 'evt-e-002', 'sales-api', 'Data sent', 'Completed', 'trace-e-001',
  ]);
  expect(screen.queryByText('Synthetic audit log')).toBeNull();
  expect(screen.getByText('Audit record unavailable for evt-a-001')).toBeTruthy();
  expect(screen.queryByRole('group', { name: 'Audit event evt-e-001' })).toBeNull();
  await userEvent.click(toggle);
  expect(details?.open).toBe(false);
});

test('dashboard identifies review cases without event IDs', async () => {
  window.history.replaceState(null, '', '/');
  const client = createApiClient();
  render(<App client={{
    ...client,
    listScenarios: async () => [{ id: 'missing', label: 'Incomplete case' }],
    analyze: async () => ({
      summary: { status: 'INCONCLUSIVE', events_processed: 0 },
      graph: { nodes: [], edges: [] },
      findings: [{ ...analysis.findings[1], evidence_event_ids: [] }],
    }),
  }} />);
  expect(await screen.findByRole('link', { name: 'Open case Incomplete case' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'No event ID available' })).toBeTruthy();
});

test.each(['#workspace', '#report', '#report?case=missing'])('a link without an available case leads to the dashboard: %s', async hash => {
  window.history.replaceState(null, '', hash);
  mockAPI();
  render(<App client={createApiClient()} />);
  expect(await screen.findByRole('link', { name: 'View report for Scenario two' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
  if (hash.includes('missing')) expect(screen.getByRole('alert').textContent).toContain('missing');
});

test('Thai labels follow the current case and persist when the app reopens', async () => {
  window.history.replaceState(null, '', '#dashboard');
  mockAPI();
  const client = createApiClient();
  const user = userEvent.setup();
  const view = render(<App client={client} />);
  await user.click(screen.getByRole('button', { name: 'ภาษาไทย' }));
  expect(await screen.findByRole('heading', { name: 'แดชบอร์ด' })).toBeTruthy();
  await user.click(await screen.findByRole('link', { name: 'เปิดเคส Scenario one' }));
  await screen.findByRole('heading', { name: 'ยืนยันการละเมิดแล้ว' });
  const route = window.location.hash;
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(window.location.hash).toBe(route);
  expect(screen.getByRole('heading', { name: 'Verified violation' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'ภาษาไทย' }));
  await user.click(screen.getByRole('link', { name: 'ดูรายงาน' }));
  await screen.findByRole('button', { name: 'พิมพ์ / บันทึก PDF' });
  view.unmount();
  render(<App client={client} />);
  expect(await screen.findByRole('heading', { name: 'รายงานการตรวจสอบ' })).toBeTruthy();
  expect(document.documentElement.lang).toBe('th');
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(document.documentElement.lang).toBe('en');
});
