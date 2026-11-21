import { useEffect, useMemo, useRef, useState } from 'react';

import { WorkspaceHeader } from './WorkspaceHeader';
import { collectReferences, EvidenceReferences, ReferenceDialog } from '../features/investigation/EvidenceReferences';
import { ControlledExplanation, InvestigationPanel, statusLabels } from '../features/investigation/InvestigationPanel';
import { LineageGraph } from '../features/lineage/LineageGraph';
import { NodeDetails } from '../features/lineage/NodeDetails';
import { getHighlightedEdgeIds } from '../features/lineage/flow-elements';
import { api, type Analysis, type Explanation, type Scenario } from '../lib/api/client';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error.';
}

export default function App({ client = api }: { client?: typeof api } = {}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioID, setScenarioID] = useState('');
  const [refresh, setRefresh] = useState(0);
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
  const explanationRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const available = await client.listScenarios(controller.signal);
        if (controller.signal.aborted) return;
        setScenarios(available);
        setScenarioID(available[0]?.id ?? '');
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
    async function load() {
      setAnalyzing(true);
      setAnalysisError(null);
      try {
        const result = await client.analyze(scenarioID, controller.signal);
        if (controller.signal.aborted) return;
        setAnalysis(result);
        setSelectedFindingId(result.findings[0]?.id ?? null);
      } catch (error) {
        if (!controller.signal.aborted) setAnalysisError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) setAnalyzing(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [scenarioID, retryAnalysis, client]);

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
    setAnalyzing(true);
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
      <main id="workspace">
        <header className="workspace-intro">
          <div>
            <h1>Investigation workspace</h1>
            <p>Trace data transfers and inspect the evidence behind each finding.</p>
          </div>
          <label className="scenario-label" htmlFor="scenario">Scenario
            <select id="scenario" value={scenarioID} disabled={listing || scenarios.length === 0}
              onChange={(event) => selectScenario(event.target.value)}>
              {scenarios.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        </header>
        <section className="analysis-state" aria-label="Analysis result">
          {listing && <p role="status">Loading scenarios…</p>}
          {analyzing && <p role="status">Analyzing scenario…</p>}
          {!listing && !listError && scenarios.length === 0 && <p>No scenarios are available.</p>}
          {listError && (
            <>
              <p role="alert">Unable to load scenarios. {listError}</p>
              <button type="button" onClick={() => {
                setListing(true);
                setListError(null);
                setSelectedNodeId(null);
                setRefresh((attempt) => attempt + 1);
              }}>Retry scenarios</button>
            </>
          )}
          {analysisError && (
            <>
              <p role="alert">Unable to analyze this scenario. {analysisError}</p>
              <button type="button" disabled={analyzing} onClick={analyzeScenario}>Retry analysis</button>
            </>
          )}
          {analysis && <div className="result-banner" data-status={analysis.summary.status} role="status">
            <div><span className="eyebrow">Analysis result</span><h2>{statusLabels[analysis.summary.status]}</h2>
            {analysis.summary.status === 'NO_VIOLATION_OBSERVED' && <p>Available events do not prove compliance.</p>}</div>
            <div className="metrics"><span><b>{analysis.summary.events_processed}</b> events processed</span>
              <span><b>{analysis.findings.length}</b> {analysis.findings.length === 1 ? 'finding' : 'findings'}</span></div>
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
              <header className="panel-heading"><h2 id="graph-title">Service lineage</h2><span>{graph.nodes.length} services</span></header>
              <LineageGraph graph={graph} selectedFindingId={selectedFindingId} onSelectNode={setSelectedNodeId} highlightedEdgeIds={highlightedEdgeIds} />
              <div className="graph-legend"><span>Observed</span><span>Inferred</span></div>
              <NodeDetails onInspect={setReferenceId} graph={graph} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            </section>
            {selectedFinding && <ControlledExplanation
              key={selectedFinding.id}
              explanation={explanation}
              explanationError={explanationError}
              explaining={explaining}
              onInspect={setReferenceId}
              onExplain={() => void explainFinding()}
            />}
          </div>
          <EvidenceReferences references={references} onInspect={setReferenceId} />
          {selectedReference && <ReferenceDialog item={selectedReference} graph={graph} onClose={() => setReferenceId(null)} />}
        </>}
      </main>
    </>
  );
}
