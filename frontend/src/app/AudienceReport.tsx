import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { statusLabels } from '../features/investigation/FindingStatus';
import { useLanguage } from '../lib/language';
import { thai } from '../lib/th';
import { TraceGuardApiError, type Analysis, type api } from '../lib/api/client';
import { localReport, matchesAnalysis } from '../lib/api/report';
import type { CaseSummary, ReportRequest, ReportSection } from '../lib/api/types';

const titles = { executive: 'Executive brief', engineering: 'Engineering report' };
const headings: Record<ReportSection['kind'], string> = {
  conclusion: 'Assessment', uncertainty: 'Limits of the evidence', route: 'Observed service links', action: 'Recommended follow-up',
};
type Edition = { summary: CaseSummary; local: boolean };

export function AudienceReport({ caseId, label, analysis, client }: {
  caseId: string; label: string; analysis: Analysis; client: typeof api;
}) {
  const { t, language: uiLanguage } = useLanguage();
  const [audience, setAudience] = useState<ReportRequest['audience']>('executive');
  const [language, setLanguage] = useState<ReportRequest['language']>(uiLanguage);
  const [edition, setEdition] = useState<Edition>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function reset() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setFailed(false);
    setEdition(undefined);
  }

  async function generate() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setFailed(false);
    const request = { scenario_id: caseId, audience, language };
    try {
      const summary = await client.reportSummary(request, controller.signal);
      if (!matchesAnalysis(summary, request, analysis)) throw new Error('Unexpected case report');
      if (!controller.signal.aborted) setEdition({ summary, local: false });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError')
        || (error instanceof TraceGuardApiError && error.status >= 500)) {
        setEdition({ summary: localReport(request, analysis), local: true });
      } else {
        setEdition(undefined);
        setFailed(true);
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  const d = (text: string) => language === 'th' ? thai[text] ?? text : text;
  return <div className="audience-report">
    <section className="edition-controls" aria-label={t('Report edition')}>
      <h3>{t('Report edition')}</h3>
      <div className="edition-options">
        <fieldset><legend>{t('Audience')}</legend><div className="edition-segment">
          {(Object.keys(titles) as Array<keyof typeof titles>).map(key =>
            <button type="button" key={key} aria-pressed={audience === key} onClick={() => {
              if (key !== audience) { reset(); setAudience(key); }
            }}>{t(titles[key])}</button>)}
        </div></fieldset>
        <fieldset><legend>{t('Report language')}</legend><div className="edition-segment">
          {(['en', 'th'] as const).map(key => <button type="button" key={key} lang={key} aria-pressed={language === key}
            onClick={() => { if (key !== language) { reset(); setLanguage(key); } }}>{key === 'en' ? 'English' : 'ไทย'}</button>)}
        </div></fieldset>
        <button type="button" className="overview-action edition-generate" disabled={busy} onClick={generate}>
          <Icon name="index" size={16} />{t(busy ? 'Preparing report…' : 'Generate summary')}</button>
      </div>
      {busy && <p role="status">{t('Preparing report…')}</p>}
      {failed && <p role="alert">{t('Could not verify this report. Reload the case and try again.')}</p>}
    </section>
    {edition && <section className="edition-result" lang={language} aria-label={d(titles[audience])}>
      <header><p className="report-citations">TraceGuard AI · {d('Synthetic audit data')}</p>
        <h3>{d(titles[audience])}</h3><p>{d(label)} · <code>{caseId}</code></p>
        <span className="review-status" data-status={edition.summary.status}>{d(statusLabels[edition.summary.status])}</span>
      </header>
      {(['conclusion', 'uncertainty', 'route', 'action'] as const).map(kind => {
        const items = edition.summary.sections.filter(s => s.kind === kind);
        if (!items.length) return null;
        return <section className="edition-group" key={kind}><h4>{d(headings[kind])}</h4><ul>{items.map((item, i) =>
          <li key={i}><p>{item.text}</p>{(item.evidence_event_ids.length > 0 || (audience === 'engineering' && item.rule_id)) &&
            <p className="edition-citations">{audience === 'engineering' && item.rule_id && <code>{item.rule_id}</code>}
              {item.evidence_event_ids.map(id => <code key={id}>{id}</code>)}</p>}</li>)}</ul></section>;
      })}
      <p className="edition-source">{d(edition.local ? 'Prepared from the case evidence loaded in this browser.'
        : edition.summary.mode === 'ai' ? 'OpenAI prioritized the follow-up actions.' : 'Follow-up actions use the case rules.')}</p>
      <footer className="print-action"><button className="overview-action" onClick={() => window.print()}><Icon name="download" size={16} />{t('Print / Save PDF')}</button>
        <button className="overview-action" onClick={reset}>{t('View full case report')}</button></footer>
    </section>}
  </div>;
}
