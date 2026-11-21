import { useEffect, useState, type ReactNode } from 'react';
import { useLanguage } from '../lib/language';
import { caseHref } from './navigation';
import { Icon } from '../components/Icon';
import { statusLabels } from '../features/investigation/FindingStatus';
import type { api, Analysis, Scenario } from '../lib/api/client';
import type { AuditEvent } from '../lib/api/types';

import { DashboardCharts, priorities, type AnalyzedCase } from './DashboardCharts';
type CaseRow = { scenario: Scenario; analysis: Analysis | null };

const scenarioLogs = import.meta.glob<{ events: AuditEvent[] }>(
  '../../../backend/internal/adapters/fixtures/data/{allowed_transfer,unauthorized_transfer,shuffled_transfer,missing_intermediate,partial_evidence_confirmed}.json',
  { eager: true, import: 'default' },
);

const auditTimeFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'UTC',
});

function auditLabel(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, letter => letter.toUpperCase());
}

function AuditRecord({ event }: { event: AuditEvent }) {
  const fields: [string, ReactNode][] = [
    ['Occurred at (UTC)', <time dateTime={event.occurred_at}>{auditTimeFormat.format(new Date(event.occurred_at))}</time>],
    ['Event ID', <code>{event.event_id}</code>],
    ['Service', <code>{event.service}</code>],
    ['Action', auditLabel(event.action)],
    ['Outcome', auditLabel(event.outcome)],
  ];
  if (event.trace_id) fields.push(['Trace ID', <code>{event.trace_id}</code>]);

  return <div role="group" aria-label={`Audit event ${event.event_id}`}>
    <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
      {fields.map(([label, value]) => <div key={label} className="surface"
        style={{ maxWidth: '100%', padding: '6px 10px', borderRadius: 7, background: 'var(--soft)', boxShadow: 'none' }}>
        <dt style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</dt>
        <dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{value}</dd>
      </div>)}
    </dl>
  </div>;
}

interface Props {
  scenarios: Scenario[];
  client: typeof api;
  listing: boolean;
  listError: string | null;
  onRefresh: () => void;
  showAll: boolean;
  onShowAll: (value: boolean) => void;
  unavailableCase?: string;
}

function CaseActions({ scenario }: { scenario: Scenario }) {
  const { t } = useLanguage();
  return <div className="case-actions">
    <a href={caseHref('workspace', scenario.id)} aria-label={t("Open case") + ' ' + t(scenario.label)}>{t("Open case")} <Icon name="route" size={15} /></a>
    <a href={caseHref('report', scenario.id)} aria-label={t("View report for") + ' ' + t(scenario.label)}>{t("View report")}</a>
  </div>;
}

export default function Dashboard({ scenarios, client, listing, listError, onRefresh, unavailableCase, showAll, onShowAll }: Props) {
  const { language, t } = useLanguage();
  const [snapshot, setSnapshot] = useState<{ catalog: Scenario[]; rows: CaseRow[]; checked: Date }>();
  useEffect(() => {
    if (!scenarios.length) return;
    const controller = new AbortController();
    async function load() {
      const rows = await Promise.all(scenarios.map(async scenario => {
        try {
          return { scenario, analysis: await client.analyze(scenario.id, controller.signal) };
        } catch {
          return { scenario, analysis: null };
        }
      }));
      if (!controller.signal.aborted) setSnapshot({ catalog: scenarios, rows, checked: new Date() });
    }
    void load();
    return () => controller.abort();
  }, [client, scenarios]);

  const current = snapshot?.catalog === scenarios ? snapshot : undefined;
  const busy = listing || (scenarios.length > 0 && !current);
  useEffect(() => {
    if (busy) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') onRefresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [busy, onRefresh]);

  const rows = current?.rows ?? [];
  const checked = rows.filter((row): row is AnalyzedCase => row.analysis !== null);
  const missing = rows.filter(r => !r.analysis);
  const ordered = priorities.flatMap(status => checked.filter(r => r.analysis.summary.status === status));
  const needsReview = ordered.filter(row => row.analysis.summary.status !== 'NO_VIOLATION_OBSERVED');
  const queue = showAll ? ordered : needsReview;

  return <main id="dashboard" className="overview-page">
    <header className="workspace-intro">
      <div><h1>{t("Dashboard")}</h1><p>{checked.length > 0
        ? <><strong>{needsReview.length} {t("of")} {checked.length}</strong> {t("analyzed cases need review.")}</>
        : t("Monitor case status and transfer evidence.")}</p></div>
      <button className="overview-action" disabled={busy} onClick={onRefresh}><Icon name="refresh" size={17} />{t("Refresh cases")}</button>
    </header>
    {unavailableCase && <p role="alert" className="overview-note">{t("Case")} <code>{unavailableCase}</code> {t("is unavailable. Choose a case from the dashboard.")}</p>}
    {listError && <p role="alert" className="overview-note">{t("Case catalog unavailable.")} {t(listError)}{scenarios.length > 0 && ' ' + t("Showing the last fetched list.")}</p>}
    {busy && <p role="status" className="overview-note">{t("Checking cases…")}</p>}
    {current && <div className="overview-grid">
      <DashboardCharts cases={ordered} />
      <section className="surface review-queue"><header className="panel-heading queue-heading"><h2><Icon name="finding" />{t("Review queue")} <span className="queue-count">{queue.length}</span></h2>
        <label><input type="checkbox" checked={showAll} onChange={event => onShowAll(event.target.checked)} /> {t("Include cases without violations")}</label></header>
        {queue.length === 0 && <p className="inset">{checked.length ? t("No analyzed cases need investigation.") : t("No analyses available.")}</p>}
        <ul className="case-queue">{queue.map(({ scenario, analysis: result }) => {
          const primary = result.findings.find(f => f.status === result.summary.status) ?? result.findings[0];
          const citedIds = primary?.evidence_event_ids ?? result.graph.edges.flatMap(edge => edge.evidence_event_ids);
          const eventIds = [...new Set(citedIds)];
          const fixture = scenarioLogs[`../../../backend/internal/adapters/fixtures/data/${scenario.id}.json`];
          const auditRecords = eventIds.map(id => ({ id, event: fixture?.events.find(event => event.event_id === id) }));
          return <li key={scenario.id}>
            <div className="queue-case">
              <h3>{eventIds.join(', ') || 'No event ID available'}</h3>
              <p>{t(primary?.message ?? "Available events do not prove compliance.")}</p>
              {auditRecords.length > 0 && <details>
                <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: 14 }}>Audit details</summary>
                {auditRecords.map(({ id, event }) => event
                  ? <AuditRecord key={id} event={event} />
                  : <p key={id}><small>Audit record unavailable for {id}</small></p>)}
              </details>}
            </div>
            <span className="review-status" data-status={result.summary.status}>{t(statusLabels[result.summary.status])}</span>
            <CaseActions scenario={scenario} />
          </li>;
        })}</ul>
      </section>
      <p className="overview-meta">{t("Checked")} <time dateTime={current.checked.toISOString()}>{current.checked.toLocaleTimeString(language)}</time> · {checked.length} {t("of")} {scenarios.length} {t("cases analyzed · Refreshes every minute")}</p>
    </div>}
    {missing.length > 0 && <div className="overview-note" role="alert"><strong>{t("Analysis unavailable")}</strong><ul className="case-queue">{missing.map(({ scenario }) => <li key={scenario.id}><strong>{t(scenario.label)}</strong><CaseActions scenario={scenario} /></li>)}</ul></div>}
    {!busy && !listError && !scenarios.length && <p className="overview-note">{t("No cases in the catalog.")}</p>}
  </main>;
}
