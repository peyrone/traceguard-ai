import { useEffect, useRef, useState } from 'react';

import { InvestigationPanel, statusLabels } from '../features/investigation/InvestigationPanel';
import { LineageGraph } from '../features/lineage/LineageGraph';
import type { Graph } from '../features/lineage/flow-elements';
import { api, hasConfiguredBackend, type Analysis, type Explanation, type Scenario } from '../lib/api/client';

const demoGraph: Graph = {
  nodes: [
    { id: 'customer-api', label: 'Customer API', kind: 'internal' },
    { id: 'sales-api', label: 'Sales API', kind: 'internal' },
    { id: 'external-crm', label: 'External CRM', kind: 'external' },
  ],
  edges: [
    {
      id: 'upstream-link',
      source: 'customer-api',
      target: 'sales-api',
      evidence_status: 'INFERRED',
      evidence_event_ids: [],
    },
    {
      id: 'external-transfer',
      source: 'sales-api',
      target: 'external-crm',
      evidence_status: 'OBSERVED',
      evidence_event_ids: ['evt-003'],
    },
  ],
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error.';
}

export default function App() {
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
        const available = await api.listScenarios(controller.signal);
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
  }, [refresh]);

  useEffect(() => {
    if (!scenarioID) return;
    const controller = new AbortController();
    async function load() {
      setAnalyzing(true);
      setAnalysisError(null);
      try {
        const result = await api.analyze(scenarioID, controller.signal);
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
  }, [scenarioID, retryAnalysis]);

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
      const result = await api.explain(finding, controller.signal);
      if (!controller.signal.aborted) setExplanation(result);
    } catch (error) {
      if (!controller.signal.aborted) setExplanationError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setExplaining(false);
    }
  }

  const preview = !hasConfiguredBackend && listError !== null;
  const graph = analysis?.graph ?? (preview ? demoGraph : null);
  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId);

  return (
    <main>
      <header className="app-header">
        <h1>TraceGuard AI</h1>
        <p>Synthetic audit data</p>
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
            <button type="button" onClick={() => {
              setAnalyzing(true);
              setAnalysisError(null);
              setRetryAnalysis((attempt) => attempt + 1);
            }}>Retry analysis</button>
          </>
        )}
        {analysis && <p role="status">{statusLabels[analysis.summary.status]} · {analysis.summary.events_processed} events processed</p>}
      </section>

      {graph && (
        <section className="graph-panel" aria-labelledby="graph-title">
          <header className="panel-header">
            <h2 id="graph-title">{preview ? 'Service lineage preview' : 'Service lineage'}</h2>
            <p>Solid links show observed transfers. Dashed links show inferred relationships.</p>
          </header>
          <LineageGraph graph={graph} selectedFindingId={selectedFindingId} onSelectNode={setSelectedNodeId} />
          <footer className="panel-footer" aria-live="polite">
            {selectedNode ? `Selected service: ${selectedNode.label}` : 'Select a service to inspect it.'}
          </footer>
        </section>
      )}
      {analysis && (
        <InvestigationPanel
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
    </main>
  );
}
