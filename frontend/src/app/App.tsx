import { LanguageProvider, useLanguage } from '../lib/language';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TransferTestPanel } from '../features/enforcement/TransferTestPanel';
import { Icon } from '../components/Icon';
import { LinkComposition } from '../features/lineage/LinkComposition';
import { caseHref, readRoute, type CaseSection } from './navigation';
import Report from './Report';
import { WorkspaceHeader } from './WorkspaceHeader';
import { collectReferences, EvidenceReferences, ReferenceDialog } from '../features/investigation/EvidenceReferences';
import { ControlledExplanation, InvestigationPanel, UpstreamEvidence, statusLabels } from '../features/investigation/InvestigationPanel';
import { NodeDetails } from '../features/lineage/NodeDetails';
import { getHighlightedEdgeIds } from '../features/lineage/flow-elements';
import { api, type Analysis, type Explanation, type Scenario } from '../lib/api/client';

const LineageGraph = lazy(() => import('../features/lineage/LineageGraph').then(module => ({ default: module.LineageGraph })));
const Dashboard = lazy(() => import('./Dashboard'));

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
  return <LanguageProvider><InvestigationApp client={client} /></LanguageProvider>;
}

function InvestigationApp({ client }: { client: typeof api }) {
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    function navigate() { setRoute(readRoute()); }
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [listing, setListing] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const refreshCatalog = useCallback(() => {
    setListing(true);
    setListError(null);
    setRefresh(attempt => attempt + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const available = await client.listScenarios(controller.signal);
        if (controller.signal.aborted) return;
        setScenarios(available);
      } catch (error) {
        if (!controller.signal.aborted) setListError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) setListing(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refresh, client]);

  const scenario = route.section === 'dashboard' ? undefined : scenarios.find(item => item.id === route.caseId);
  useEffect(() => {
    const page = route.section === 'report' ? t("Report") : t("Workspace");
    document.title = (scenario ? t(scenario.label) + ' · ' + page : t("Dashboard")) + ' · TraceGuard AI';
  }, [route.section, scenario, t]);
  if (route.section !== 'dashboard') {
    if (scenario) return <CaseView key={scenario.id} scenario={scenario} section={route.section} client={client} />;
    if (listing) return <><WorkspaceHeader /><main><p role="status">{t("Loading case catalog…")}</p></main></>;
  }

  return <>
    <WorkspaceHeader />
    <Suspense fallback={<main><p role="status">{t("Loading dashboard…")}</p></main>}>
      <Dashboard showAll={showAll} onShowAll={setShowAll} scenarios={scenarios} client={client} listing={listing} listError={listError} onRefresh={refreshCatalog}
        unavailableCase={route.section !== 'dashboard' && !listError ? route.caseId : undefined} />
    </Suspense>
  </>;
}

function CaseView({ scenario, section, client }: { scenario: Scenario; section: CaseSection; client: typeof api }) {
  const { t } = useLanguage();
  const scenarioID = scenario.id;
  const report = section === 'report';
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
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

  useEffect(() => {
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
  }, [analysis, selectedFindingId, section]);

  useEffect(() => () => explanationRequest.current?.abort(), []);

  function resetExplanation() {
    explanationRequest.current?.abort();
    setExplanation(null);
    setExplanationError(null);
    setExplaining(false);
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

  useEffect(() => {
    if (section !== 'references') document.documentElement.scrollIntoView?.({ block: 'start' });
  }, [section]);

  useEffect(() => {
    if (section === 'references' && analysis) document.getElementById('references')?.scrollIntoView?.();
  }, [section, analysis]);

  return (
    <>
      <WorkspaceHeader />
      <main id={report ? "report" : "workspace"} ref={workspace}>
        <header className="workspace-intro">
          <div>
            <a className="back-to-cases" href="#dashboard">{t("← Back to dashboard")}</a>
            <h1>{report ? t("Investigation report") : t("Investigation workspace")}</h1>
            <p className="case-identity"><strong>{t(scenario.label)}</strong><code>{scenarioID}</code></p>
          </div>
          <div className="case-page-links">
            {!report && analysis && <a href={caseHref('references', scenarioID)}
              onClick={() => { if (section === 'references') document.getElementById('references')?.scrollIntoView?.(); }}>{t("Evidence references")}</a>}
            <a className="case-page-action" href={caseHref(report ? 'workspace' : 'report', scenarioID)}>
              {report ? t("Open case") : t("View report")} <Icon name="route" size={16} />
            </a>
          </div>
        </header>
        <section className="analysis-state" aria-label={t("Analysis result")}>
          {analyzing && <div className="case-download" key={scenarioID} role="status">
            <span className="case-download-icon" aria-hidden="true"><Icon name="download" size={26} /></span>
            <div><strong>{t("Retrieving case analysis…")}</strong>
              <p>{t(scenario.label)}</p></div>
            <span className="case-download-track" aria-hidden="true" />
          </div>}
          {analysisError && (
            <>
              <p role="alert">{t("Unable to analyze this case.")} {t(analysisError)}</p>
              <button type="button" disabled={analyzing} onClick={analyzeScenario}>{t("Retry analysis")}</button>
            </>
          )}
          {!report && analysis && <div className="result-banner" data-status={analysis.summary.status} role="status">
            <span className="result-symbol"><Icon name={resultIcons[analysis.summary.status]} size={28} /></span>
            <div className="result-summary">
              <span className="eyebrow">{t("Analysis result")}</span>
              <h2>{t(statusLabels[analysis.summary.status])}</h2>
              {analysis.summary.status === 'NO_VIOLATION_OBSERVED' && <p>{t("Available events do not prove compliance.")}</p>}
            </div>
            <div className="result-metrics">
              <div><Icon name="activity" size={16} /><b>{analysis.summary.events_processed}</b> <span>{t("events processed")}</span></div>
              <div><Icon name="finding" size={16} /><b>{analysis.findings.length}</b> <span>{analysis.findings.length === 1 ? t("finding") : t("findings")}</span></div>
            </div>
          </div>}
        </section>
        {report && analysis && <Report caseId={scenarioID} label={scenario.label} client={client} analysis={analysis} />}
        {!report && analysis && graph && <>
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
              <header className="panel-heading"><h2 id="graph-title"><Icon name="network" />{t("Service lineage")}</h2><span>{graph.nodes.length} {t("services")}</span></header>
              <Suspense fallback={<p className="inset" role="status">{t("Loading service lineage…")}</p>}>
                <LineageGraph graph={graph} onInspect={setReferenceId} onSelectNode={setSelectedNodeId} highlightedEdgeIds={highlightedEdgeIds} />
              </Suspense>
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
        {!report && <TransferTestPanel
          key={scenarioID + ":" + (analysis ? "ready" : "waiting")}
          scenarioID={scenarioID}
          analysis={analysis}
          loading={analyzing}
          decide={client.decidePrivacy}
        />}
      </main>
    </>
  );
}
