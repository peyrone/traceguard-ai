import type { Graph } from '../../features/lineage/flow-elements';

export interface Scenario {
  id: string;
  label: string;
}

export type Status = 'VERIFIED_VIOLATION' | 'POTENTIAL_VIOLATION' | 'INCONCLUSIVE' | 'NO_VIOLATION_OBSERVED';

export interface Finding {
  id: string;
  rule_id: string;
  status: Status;
  message: string;
  evidence_event_ids: string[];
  missing_evidence: string[];
}

export interface Analysis {
  summary: { status: Status; events_processed: number };
  graph: Graph;
  findings: Finding[];
}

export interface Explanation {
  explanation: string;
  next_steps: string[];
  evidence_event_ids: string[];
  mode: 'ai' | 'fallback';
}

type Endpoint = 'scenarios' | 'analyze' | 'explain';
const configuredBaseURL = import.meta.env?.VITE_API_BASE_URL?.trim() ?? '';
export const hasConfiguredBackend = configuredBaseURL !== '';

export function apiURL(baseURL: string, endpoint: Endpoint): string {
  const base = (baseURL.trim() || 'http://localhost:8080').replace(/\/+$/, '');
  const versioned = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${versioned}/${endpoint}`;
}

export function createApiClient(baseURL = configuredBaseURL) {
  async function request<T>(endpoint: Endpoint, signal: AbortSignal, data?: object): Promise<T> {
    const response = await fetch(apiURL(baseURL, endpoint), {
      method: data ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined,
      signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(typeof body?.message === 'string' ? body.message : `API request failed (${response.status}).`);
    }
    return response.json();
  }

  return {
    listScenarios: (signal: AbortSignal) => request<Scenario[]>('scenarios', signal),
    analyze: (scenarioID: string, signal: AbortSignal) =>
      request<Analysis>('analyze', signal, { scenario_id: scenarioID }),
    explain: (finding: Finding, signal: AbortSignal) => request<Explanation>('explain', signal, {
      finding,
      rule_summary: finding.rule_id === 'DENY_PURPOSE'
        ? 'The transfer purpose must be on the policy allowlist.'
        : 'Transfers covered by the policy must use an allowed destination and purpose.',
      evidence: finding.evidence_event_ids.map((event_id) => ({ event_id })),
    }),
  };
}

export const api = createApiClient();
