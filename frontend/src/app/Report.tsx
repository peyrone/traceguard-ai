import { useLanguage } from '../lib/language';
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
  const { t } = useLanguage();
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

  return <article className="surface report-paper" aria-label={t("Case report")}>
    <p className="report-print-title">{t("TraceGuard AI · Investigation report")}</p>
    <header className="report-mast"><div><span className="review-status" data-status={analysis.summary.status}>{t(statusLabels[analysis.summary.status])}</span>
      <h2>{t(label)}</h2><code>{caseId}</code></div>
      <button className="overview-action print-action" disabled={loading} onClick={() => window.print()}><Icon name="download" size={16} />{t("Print / Save PDF")}</button>
    </header>
    <p className="report-scope">{t("Synthetic audit data ·")} {analysis.summary.events_processed} {t("events processed ·")} {analysis.findings.length} {t("findings")}</p>
    <section className="report-block"><h3>{t("Findings and explanations")}</h3>
      {loading && <p role="status">{t("Preparing explanations…")}</p>}
      {analysis.findings.length === 0 && <p>{t("No violation was found in the available evidence. These events alone do not establish compliance.")}</p>}
      {analysis.findings.map(f => {
        const note = notes?.get(f.id);
        return <section className="report-finding" key={f.id}>
          <span className="review-status" data-status={f.status}>{t(statusLabels[f.status])}</span>
          <h4>{t(f.message)}</h4><p className="report-citations">{t("Rule")} <code>{f.rule_id}</code> {t("· Evidence")} <code>{f.evidence_event_ids.join(', ') || t("None cited")}</code></p>
          {note && <>
            <p>{note.explanation}</p>
            {note.evidence_event_ids.length > 0 && <p className="report-citations">{t("Explanation cites")} <code>{note.evidence_event_ids.join(', ')}</code></p>}
            {Boolean(note.insights?.length) && <><h5>{t("Investigation insights")}</h5><ul>{note.insights?.map((item, i) =>
              <li key={i}>{item.text} <code>{item.evidence_event_ids.join(', ')}</code></li>)}</ul></>}
            {Boolean(note.gdpr_mappings?.length) && <><h5>{t("GDPR considerations for review")}</h5>
              <ul>{note.gdpr_mappings?.map((item, i) => <li key={i}><strong>{t("Article")} {item.reference.article} · {item.assessment === 'potential_concern' ? t("Potential concern") : t("Insufficient information")}</strong>
                <p>{item.rationale}</p><p>{t("Facts to verify:")} {item.missing_facts.join(' ')}</p>
                <p className="report-citations">{t("Evidence")} <code>{item.evidence_event_ids.join(', ')}</code> · <a href={item.reference.source_url}>{item.reference.title}</a></p>
              </li>)}</ul></>}
            {note.next_steps.length > 0 && <><h5>{note.mode === 'ai' ? t("AI-prioritized next steps") : t("Rule-based next steps")}</h5>
              <ol>{note.next_steps.map(step => <li key={step}>{step}</li>)}</ol></>}
          </>}
          {note === null && <p role="alert">{t("Explanation unavailable for this finding.")}</p>}
          {f.missing_evidence.length > 0 && <><h5>{t("Missing evidence")}</h5><ul>{f.missing_evidence.map(gap => <li key={gap}>{t(gap)}</li>)}</ul></>}
        </section>;
      })}
      {notes && [...notes.values()].includes(null) && <button className="print-action" onClick={() => { setNotes(undefined); setAttempt(n => n + 1); }}>{t("Retry explanations")}</button>}
    </section>
    <section className="report-block"><h3>{t("Transfer evidence")}</h3><p className="report-citations">{observed} {t("observed ·")} {analysis.graph.edges.length - observed} {t("inferred")}</p>
      {!analysis.graph.edges.length && <p>{t("No service links were returned.")}</p>}
      <ul className="report-edges">{analysis.graph.edges.map(e => <li key={e.id}><strong>{names.get(e.source) ?? e.source} → {names.get(e.target) ?? e.target}</strong>
        <span>{e.evidence_status === 'OBSERVED' ? t("Observed transfer") : t("Inferred link")} · <code>{e.evidence_event_ids.join(', ') || t("No citations")}</code></span></li>)}</ul>
    </section>
  </article>;
}
