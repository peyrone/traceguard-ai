import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { TransferTestPanel } from '../features/enforcement/TransferTestPanel';
import { Icon } from '../components/Icon';
import { LinkComposition } from '../features/lineage/LinkComposition';
import { WorkspaceHeader } from './WorkspaceHeader';
import { collectReferences, EvidenceReferences, ReferenceDialog } from '../features/investigation/EvidenceReferences';
import { ControlledExplanation, InvestigationPanel, UpstreamEvidence, statusLabels } from '../features/investigation/InvestigationPanel';
import { LineageGraph } from '../features/lineage/LineageGraph';
import { NodeDetails } from '../features/lineage/NodeDetails';
import { getHighlightedEdgeIds } from '../features/lineage/flow-elements';
import { api, type Analysis, type Explanation, type Scenario } from '../lib/api/client';

const resultRevealDelayMs = 500;
const resultIcons = {
  VERIFIED_VIOLATION: 'violation',
  POTENTIAL_VIOLATION: 'warning',
  INCONCLUSIVE: 'finding',
  NO_VIOLATION_OBSERVED: 'shield',
} as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error.';
}

export default function App({ client = api }: { client?: typeof api } = {}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioID, setScenarioID] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [catalogFetchedAt, setCatalogFetchedAt] = useState<Date | null>(null);
  const [listing, setListing] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [retryAnalysis, setRetryAnalysis] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const workspace = useRef<HTMLElement>(null);
  const explanationRequest = useRef<AbortController | null>(null);

  const acceptCatalog = useEffectEvent((available: Scenario[]) => {
    setScenarios(available);
    setCatalogFetchedAt(new Date());
    if (!available.some(item => item.id === scenarioID)) selectScenario(available[0]?.id ?? '');
  });

  function refreshCatalog() {
    setListing(true);
    setListError(null);
    setRefresh(attempt => attempt + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const available = await client.listScenarios(controller.signal);
        if (controller.signal.aborted) return;
        acceptCatalog(available);
      } catch (error) {
        if (!controller.signal.aborted) setListError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) setListing(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refresh, client]);

  useEffect(() => {
    if (!scenarioID) return;
    const controller = new AbortController();
    let revealTimer: number | undefined;
    async function load() {
      setAnalyzing(true);
      setAnalysisError(null);
      try {
        const result = await client.analyze(scenarioID, controller.signal);
        if (controller.signal.aborted) return;
        revealTimer = window.setTimeout(() => {
          setAnalysis(result);
          const primaryFinding = result.findings.find(finding => finding.status === result.summary.status);
          setSelectedFindingId(primaryFinding?.id ?? result.findings[0]?.id ?? null);
          setAnalyzing(false);
        }, resultRevealDelayMs);
      } catch (error) {
        if (controller.signal.aborted) return;
        setAnalysisError(errorMessage(error));
        setAnalyzing(false);
      }
    }
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(revealTimer);
    };
  }, [scenarioID, retryAnalysis, client]);

  useEffect(() => {
    if (!analysis || !workspace.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('panel-in-view');
          observer.unobserve(entry.target);
        }
      }
    });
    for (const panel of workspace.current.querySelectorAll('.surface:not(.panel-in-view)')) {
      observer.observe(panel);
    }
    return () => observer.disconnect();
  }, [analysis, selectedFindingId]);

  useEffect(() => () => explanationRequest.current?.abort(), []);

  function resetExplanation() {
    explanationRequest.current?.abort();
    setExplanation(null);
    setExplanationError(null);
    setExplaining(false);
  }

  function selectScenario(id: string) {
    if (id === scenarioID) return;
    resetExplanation();
    setReferenceId(null);
    setAnalysis(null);
    setAnalyzing(id !== '');
    setAnalysisError(null);
    setSelectedFindingId(null);
    setSelectedNodeId(null);
    setScenarioID(id);
  }

  async function explainFinding() {
    const finding = analysis?.findings.find((item) => item.id === selectedFindingId);
    if (!finding) return;
    resetExplanation();
    const controller = new AbortController();
    explanationRequest.current = controller;
    setExplaining(true);
    try {
      const result = await client.explain(finding, controller.signal);
      if (!controller.signal.aborted) setExplanation(result);
    } catch (error) {
      if (!controller.signal.aborted) setExplanationError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setExplaining(false);
    }
  }

  const references = useMemo(() => analysis ? collectReferences(analysis.graph, analysis.findings) : [], [analysis]);
  const selectedReference = references.find(item => item.id === referenceId);
  const graph = analysis?.graph;
  const selectedFinding = analysis?.findings.find((finding) => finding.id === selectedFindingId);
  const highlightedEdgeIds = graph ? getHighlightedEdgeIds(graph, selectedFinding?.evidence_event_ids ?? []) : [];

  function analyzeScenario() {
    resetExplanation();
    setReferenceId(null);
    setAnalysis(null);
    setSelectedFindingId(null);
    setSelectedNodeId(null);
    setAnalysisError(null);
    setAnalyzing(true);
    setRetryAnalysis((attempt) => attempt + 1);
  }

  return (
    <>
      <WorkspaceHeader hasReferences={Boolean(analysis)} />
      <main id="workspace" ref={workspace}>
        <header className="workspace-intro">
          <div>
            <h1>Investigation workspace</h1>
            <p>Trace data transfers and inspect the evidence behind each finding.</p>
          </div>
          <section className="case-picker" aria-label="Case catalog">
            <div className="case-picker-heading">
              <label htmlFor="scenario">Investigation case</label>
              {catalogFetchedAt && <span>{scenarios.length} {scenarios.length === 1 ? 'case' : 'cases'}</span>}
            </div>
            <div className="case-picker-controls">
              <select id="scenario" value={scenarioID} disabled={scenarios.length === 0}
                onChange={(event) => selectScenario(event.target.value)}>
                {scenarios.length === 0 && <option value="">{listing ? 'Loading cases…' : 'No cases available'}</option>}
                {scenarios.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
              <button type="button" onClick={refreshCatalog} disabled={listing}
                aria-label={listError ? 'Retry case catalog' : 'Refresh case catalog'}
                title="Refresh case catalog"><Icon name="refresh" /></button>
            </div>
            <div className="case-picker-meta">
              {scenarioID && <code title="Case ID"><span className="sr-only">Case ID </span>{scenarioID}</code>}
              {listing ? <span role="status">Fetching catalog…</span> : catalogFetchedAt &&
                <span>Fetched <time dateTime={catalogFetchedAt.toISOString()} title={catalogFetchedAt.toLocaleString()}>
                  {catalogFetchedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </time></span>}
            </div>
            {listError && <p role="alert">Case catalog unavailable. {listError}{catalogFetchedAt && ' Showing the last fetched list.'}</p>}
          </section>
        </header>
        <section className="analysis-state" aria-label="Analysis result">
          {analyzing && <div className="case-download" key={scenarioID} role="status">
            <span className="case-download-icon" aria-hidden="true"><Icon name="download" size={26} /></span>
            <div><strong>Retrieving case analysis…</strong>
              <p>{scenarios.find(item => item.id === scenarioID)?.label ?? scenarioID}</p></div>
            <span className="case-download-track" aria-hidden="true" />
          </div>}
          {analysisError && (
            <>
              <p role="alert">Unable to analyze this case. {analysisError}</p>
              <button type="button" disabled={analyzing} onClick={analyzeScenario}>Retry analysis</button>
            </>
          )}
          {analysis && <div className="result-banner" data-status={analysis.summary.status} role="status">
            <span className="result-symbol"><Icon name={resultIcons[analysis.summary.status]} size={28} /></span>
            <div className="result-summary">
              <span className="eyebrow">Analysis result</span>
              <h2>{statusLabels[analysis.summary.status]}</h2>
              {analysis.summary.status === 'NO_VIOLATION_OBSERVED' && <p>Available events do not prove compliance.</p>}
            </div>
            <div className="result-metrics">
              <div><Icon name="activity" size={16} /><b>{analysis.summary.events_processed}</b> <span>events processed</span></div>
              <div><Icon name="finding" size={16} /><b>{analysis.findings.length}</b> <span>{analysis.findings.length === 1 ? 'finding' : 'findings'}</span></div>
            </div>
          </div>}
        </section>
        {analysis && graph && <>
          <div className="workspace-grid">
            <InvestigationPanel
              onInspect={setReferenceId}
              graph={analysis.graph}
              findings={analysis.findings}
              selectedFindingId={selectedFindingId}
              onSelectFinding={(id) => {
                if (id === selectedFindingId) return;
                resetExplanation();
                setSelectedFindingId(id);
              }}
            />
            <section className="graph-panel surface" aria-labelledby="graph-title">
              <header className="panel-heading"><h2 id="graph-title"><Icon name="network" />Service lineage</h2><span>{graph.nodes.length} services</span></header>
              <LineageGraph graph={graph} selectedFindingId={selectedFindingId} onSelectNode={setSelectedNodeId} highlightedEdgeIds={highlightedEdgeIds} />
              <LinkComposition edges={graph.edges} />
              <NodeDetails onInspect={setReferenceId} graph={graph} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            </section>
            {selectedFinding && <ControlledExplanation
              key={selectedFinding.id}
              finding={selectedFinding}
              relatedEvidence={<UpstreamEvidence graph={graph} finding={selectedFinding} findings={analysis.findings} />}
              explanation={explanation}
              explanationError={explanationError}
              explaining={explaining}
              onInspect={setReferenceId}
              onExplain={() => void explainFinding()}
            />}
          </div>
          <EvidenceReferences graph={graph} selectedFindingId={selectedFindingId} references={references} onInspect={setReferenceId} />
          {selectedReference && <ReferenceDialog item={selectedReference} graph={graph} onClose={() => setReferenceId(null)} />}
        </>}
        <TransferTestPanel decide={client.decidePrivacy} />
      </main>
    </>
  );
}
