import { statusLabels } from '../features/investigation/FindingStatus';
import type { Analysis, Scenario } from '../lib/api/client';
import { caseHref } from './navigation';
import './dashboard-charts.css';

export const priorities = ['VERIFIED_VIOLATION', 'POTENTIAL_VIOLATION', 'INCONCLUSIVE', 'NO_VIOLATION_OBSERVED'] as const;
export type AnalyzedCase = { scenario: Scenario; analysis: Analysis };

export function DashboardCharts({ cases }: { cases: AnalyzedCase[] }) {
  const distribution = priorities.map(status => ({
    status, count: cases.filter(row => row.analysis.summary.status === status).length,
  }));
  let offset = 0;
  const segments = distribution.filter(item => item.count > 0).map(({ status, count }) => {
    const start = offset;
    offset += count / cases.length * 100;
    return 'var(--' + status + ') ' + start + '% ' + offset + '%';
  });
  const evidence = cases.map(({ scenario, analysis }) => {
    const edges = analysis.graph.edges;
    const observed = edges.filter(edge => edge.evidence_status === 'OBSERVED').length;
    return { scenario, observed, inferred: edges.length - observed, total: edges.length };
  }).sort((a, b) => b.total - a.total);
  const maxLinks = Math.max(1, evidence[0]?.total ?? 0);

  return <div className="dashboard-charts">
    <figure className="surface distribution-chart" aria-labelledby="case-distribution">
      <figcaption id="case-distribution">Case status distribution</figcaption>
      <div className="distribution-body">
        <div className="status-ring" aria-hidden="true" style={{ backgroundImage: segments.length ? 'conic-gradient(' + segments.join(', ') + ')' : undefined }}>
          <div><b>{cases.length}</b><span>analyzed</span></div>
        </div>
        <ul className="distribution-key">{distribution.map(({ status, count }) =>
          <li key={status}><i aria-hidden="true" style={{ background: 'var(--' + status + ')' }} />
            <span>{statusLabels[status]}</span><b>{count}</b>
            <small>{cases.length ? Math.round(100 * count / cases.length) + '%' : '—'}</small>
          </li>)}</ul>
      </div>
    </figure>
    <figure className="surface evidence-chart" aria-labelledby="case-evidence">
      <figcaption id="case-evidence">Evidence links by case</figcaption>
      <div className="chart-key"><span><i className="observed-bar" />Observed</span><span><i className="inferred-bar" />Inferred</span></div>
      {evidence.length === 0 && <p>No analyzed cases to compare.</p>}
      <ul>{evidence.slice(0, 5).map(({ scenario, observed, inferred }) =>
        <li key={scenario.id}>
          <a href={caseHref('workspace', scenario.id)}>{scenario.label}</a>
          <div className="evidence-meter" aria-hidden="true">
            <i className="observed-bar" style={{ width: observed / maxLinks * 100 + '%' }} />
            <i className="inferred-bar" style={{ width: inferred / maxLinks * 100 + '%' }} />
          </div>
          <span className="chart-values" title={observed + ' observed, ' + inferred + ' inferred'}>
            {observed}<span className="sr-only"> observed</span><span aria-hidden="true"> / </span>{inferred}<span className="sr-only"> inferred</span>
          </span>
        </li>)}</ul>
      {evidence.length > 5 && <p>Showing the five cases with the most evidence links.</p>}
    </figure>
  </div>;
}
