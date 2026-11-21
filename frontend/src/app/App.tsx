import { useEffect, useRef, useState } from 'react';

import { InvestigationPanel, statusLabels } from '../features/investigation/InvestigationPanel';
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

  const graph = analysis?.graph;
  const selectedFinding = analysis?.findings.find((finding) => finding.id === selectedFindingId);
  const highlightedEdgeIds = graph ? getHighlightedEdgeIds(graph, selectedFinding?.evidence_event_ids ?? []) : [];

  function analyzeScenario() {
    resetExplanation();
    setAnalysis(null);
    setSelectedFindingId(null);
    setSelectedNodeId(null);
    setAnalysisError(null);
    setAnalyzing(true);
    setRetryAnalysis((attempt) => attempt + 1);
  }

  return (
    <main>
      <header className="app-header">
        <h1>TraceGuard AI</h1>
        <p>Synthetic audit data · API mode</p>
      </header>

      <section className="scenario-controls" aria-label="Scenario controls">
        <label htmlFor="scenario">Scenario</label>
        <select id="scenario" value={scenarioID} disabled={listing || scenarios.length === 0}
          onChange={(event) => selectScenario(event.target.value)}>
          {scenarios.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
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
        {analysis && <p role="status">{statusLabels[analysis.summary.status]} · {analysis.summary.events_processed} events processed</p>}
        {analysis?.summary.status === 'NO_VIOLATION_OBSERVED' && <p>Available events do not prove compliance.</p>}
      </section>

      <div className="workspace-grid">
      {graph && (
        <section className="graph-panel" aria-labelledby="graph-title">
          <header className="panel-header">
            <h2 id="graph-title">Service lineage</h2>
            <p>Solid links show observed transfers. Dashed links show inferred relationships.</p>
          </header>
          <LineageGraph graph={graph} selectedFindingId={selectedFindingId} onSelectNode={setSelectedNodeId} highlightedEdgeIds={highlightedEdgeIds} />
          <NodeDetails graph={graph} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
        </section>
      )}
      {analysis && (
        <InvestigationPanel
          graph={analysis.graph}
          findings={analysis.findings}
          selectedFindingId={selectedFindingId}
          onSelectFinding={(id) => {
            if (id === selectedFindingId) return;
            resetExplanation();
            setSelectedFindingId(id);
          }}
          explanation={explanation}
          explanationError={explanationError}
          explaining={explaining}
          onExplain={() => void explainFinding()}
        />
      )}
      </div>
    </main>
  );
}
