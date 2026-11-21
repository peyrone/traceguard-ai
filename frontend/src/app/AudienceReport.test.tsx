import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudienceReport } from './AudienceReport';
import { createApiClient } from '../lib/api/client';
import { localReport } from '../lib/api/report';
import type { AnalyzeResponse, CaseSummary, ReportRequest } from '../lib/api/types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const analysis: AnalyzeResponse = {
  summary: { status: 'VERIFIED_VIOLATION', events_processed: 2 },
  findings: [{ status: 'VERIFIED_VIOLATION', id: 'finding', rule_id: 'DENY_EXTERNAL_PII', message: 'Recorded export',
    evidence_event_ids: ['evt-e-002'], missing_evidence: [] }],
  graph: { nodes: [], edges: [
    { id: 'e1', source: 'customer-api', target: 'sales-api', evidence_status: 'INFERRED', evidence_event_ids: ['evt-e-001'] },
    { id: 'e2', source: 'sales-api', target: 'external-crm', evidence_status: 'OBSERVED', evidence_event_ids: ['evt-e-002'] },
  ] },
};
function mount(generate: ReturnType<typeof createApiClient>['reportSummary']) {
  return render(<AudienceReport analysis={analysis} client={{ ...createApiClient(), reportSummary: generate }}
    caseId="partial_evidence_confirmed" label="Partial evidence, confirmed violation" />);
}

test('generates on request, prints the selected edition and preserves offline evidence', async () => {
  const generate = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  mount(generate);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Engineering report' }));
  await user.click(screen.getByRole('button', { name: 'ไทย' }));
  expect(generate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Generate summary' }));
  const edition = screen.getByRole('region', { name: 'รายงานสำหรับวิศวกร' });
  expect(edition.lang).toBe('th');
  expect(edition.textContent).toContain('evt-e-002');
  expect(edition.textContent).toContain('evt-e-001');
  expect(edition.textContent).toContain('DENY_EXTERNAL_PII');
  expect(edition.textContent).toContain('เบราว์เซอร์');
  expect(generate).toHaveBeenCalledTimes(1);
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  await user.click(within(edition).getByRole('button', { name: 'Print / Save PDF' }));
  expect(print).toHaveBeenCalledOnce();
});

test('discards a late edition after switching audience and refuses foreign citations', async () => {
  let finish!: (value: CaseSummary) => void;
  const generate = vi.fn()
    .mockImplementationOnce(() => new Promise<CaseSummary>(resolve => { finish = resolve; }))
    .mockImplementationOnce(async (r: ReportRequest) => ({ ...localReport(r, analysis), sections: [
      { kind: 'conclusion', text: 'Foreign receipt', evidence_event_ids: ['other-case'] },
    ] }));
  mount(generate);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Generate summary' }));
  await user.click(screen.getByRole('button', { name: 'Engineering report' }));
  expect(generate.mock.calls[0][1].aborted).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Generate summary' }));
  await act(async () => { finish(localReport(generate.mock.calls[0][0], analysis)); });
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Foreign receipt')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Executive brief' })).toBeNull();
});
