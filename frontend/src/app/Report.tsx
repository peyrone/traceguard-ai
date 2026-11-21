import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { statusLabels } from '../features/investigation/FindingStatus';
import type { Analysis, Explanation, api } from '../lib/api/client';

interface Props {
  analysis: Analysis;
  caseId: string;
  label: string;
  client: typeof api;
}

export default function Report({ analysis, caseId, label, client }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [notes, setNotes] = useState<Map<string, Explanation | null>>();
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const entries = await Promise.all(analysis.findings.map(async finding => {
        try {
          return [finding.id, await client.explain(finding, controller.signal)] as const;
        } catch {
          return [finding.id, null] as const;
        }
      }));
      if (!controller.signal.aborted) setNotes(new Map(entries));
    }
    void load();
    return () => controller.abort();
  }, [analysis, attempt, client]);

  const loading = analysis.findings.length > 0 && !notes;
  const observed = analysis.graph.edges.filter(e => e.evidence_status === 'OBSERVED').length;
  const names = new Map(analysis.graph.nodes.map(n => [n.id, n.label]));

  return <article className="surface report-paper" aria-label="Case report">
    <p className="report-print-title">TraceGuard AI · Investigation report</p>
    <header className="report-mast"><div><span className="review-status" data-status={analysis.summary.status}>{statusLabels[analysis.summary.status]}</span>
      <h2>{label}</h2><code>{caseId}</code></div>
      <button className="overview-action print-action" disabled={loading} onClick={() => window.print()}><Icon name="download" size={16} />Print / Save PDF</button>
    </header>
    <p className="report-scope">Synthetic audit data · {analysis.summary.events_processed} events processed · {analysis.findings.length} findings</p>
    <section className="report-block"><h3>Findings and explanations</h3>
      {loading && <p role="status">Preparing explanations…</p>}
      {analysis.findings.length === 0 && <p>No violation was found in the available evidence. These events alone do not establish compliance.</p>}
      {analysis.findings.map(f => {
        const note = notes?.get(f.id);
        return <section className="report-finding" key={f.id}>
          <span className="review-status" data-status={f.status}>{statusLabels[f.status]}</span>
          <h4>{f.message}</h4><p className="report-citations">Rule <code>{f.rule_id}</code> · Evidence <code>{f.evidence_event_ids.join(', ') || 'None cited'}</code></p>
          {note && <>
            <p>{note.explanation}</p>
            {note.evidence_event_ids.length > 0 && <p className="report-citations">Explanation cites <code>{note.evidence_event_ids.join(', ')}</code></p>}
            {Boolean(note.insights?.length) && <><h5>Investigation insights</h5><ul>{note.insights?.map((item, i) =>
              <li key={i}>{item.text} <code>{item.evidence_event_ids.join(', ')}</code></li>)}</ul></>}
            {Boolean(note.gdpr_mappings?.length) && <><h5>GDPR considerations for review</h5>
              <ul>{note.gdpr_mappings?.map((item, i) => <li key={i}><strong>Article {item.reference.article} · {item.assessment === 'potential_concern' ? 'Potential concern' : 'Insufficient information'}</strong>
                <p>{item.rationale}</p><p>Facts to verify: {item.missing_facts.join(' ')}</p>
                <p className="report-citations">Evidence <code>{item.evidence_event_ids.join(', ')}</code> · <a href={item.reference.source_url}>{item.reference.title}</a></p>
              </li>)}</ul></>}
            {note.next_steps.length > 0 && <><h5>{note.mode === 'ai' ? 'AI-prioritized next steps' : 'Rule-based next steps'}</h5>
              <ol>{note.next_steps.map(step => <li key={step}>{step}</li>)}</ol></>}
          </>}
          {note === null && <p role="alert">Explanation unavailable for this finding.</p>}
          {f.missing_evidence.length > 0 && <><h5>Missing evidence</h5><ul>{f.missing_evidence.map(gap => <li key={gap}>{gap}</li>)}</ul></>}
        </section>;
      })}
      {notes && [...notes.values()].includes(null) && <button className="print-action" onClick={() => { setNotes(undefined); setAttempt(n => n + 1); }}>Retry explanations</button>}
    </section>
    <section className="report-block"><h3>Transfer evidence</h3><p className="report-citations">{observed} observed · {analysis.graph.edges.length - observed} inferred</p>
      {!analysis.graph.edges.length && <p>No service links were returned.</p>}
      <ul className="report-edges">{analysis.graph.edges.map(e => <li key={e.id}><strong>{names.get(e.source) ?? e.source} → {names.get(e.target) ?? e.target}</strong>
        <span>{e.evidence_status === 'OBSERVED' ? 'Observed transfer' : 'Inferred link'} · <code>{e.evidence_event_ids.join(', ') || 'No citations'}</code></span></li>)}</ul>
    </section>
  </article>;
}
