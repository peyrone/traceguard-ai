import { createExplainRequest, evidenceIdsForRequest } from "./explanation.ts";
import { isAnalyzeResponse, isErrorResponse, isExplainResponse, isPrivacyDecisionResponse, isScenarioList } from "./response.ts";
import type { Finding, PrivacyDecisionRequest, PrivacyDecisionResponse, TraceGuardClient } from "./types.ts";

export type { AnalysisStatus as Status, AnalyzeResponse as Analysis, ExplainResponse as Explanation, Finding, Scenario } from "./types.ts";

type Endpoint = "scenarios" | "analyze" | "explain";
const configuredBaseURL = import.meta.env?.VITE_API_BASE_URL?.trim() ?? "";
// Leave transport headroom above the Go provider’s five-second maximum.
const explanationDeadlineMs = 6_000;
const localBaseURL = "http://localhost:8080";
export const hasConfiguredBackend = configuredBaseURL !== "";

function versionedBaseURL(baseURL: string): string {
  const base = baseURL.trim().replace(/\/+$/, "");
  return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
}

export function apiURL(baseURL: string, endpoint: Endpoint): string {
  return `${versionedBaseURL(baseURL.trim() || localBaseURL)}/${endpoint}`;
}

export class TraceGuardApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TraceGuardApiError";
    this.status = status;
    this.code = code;
  }
}

interface ClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export function createTraceGuardClient({
  baseUrl = "",
  fetch: fetchRequest = globalThis.fetch.bind(globalThis),
}: ClientOptions = {}): TraceGuardClient & { decidePrivacy(input: PrivacyDecisionRequest, signal?: AbortSignal): Promise<PrivacyDecisionResponse> } {
  const prefix = versionedBaseURL(baseUrl);

  async function request<T>(
    path: string,
    isResponse: (value: unknown) => value is T,
    signal?: AbortSignal,
    payload?: object,
  ): Promise<T> {
    const response = await fetchRequest(prefix + path, {
      method: payload === undefined ? "GET" : "POST",
      headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal,
    });
    const data: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = isErrorResponse(data) ? data : {
        code: "HTTP_ERROR",
        message: `TraceGuard API request failed (HTTP ${response.status}).`,
      };
      throw new TraceGuardApiError(response.status, error.code, error.message);
    }
    if (!isResponse(data)) throw new Error("TraceGuard API returned an unexpected response.");
    return data;
  }

  return {
    listScenarios: (signal) => request("/scenarios", isScenarioList, signal),
    analyze: (input, signal) => request("/analyze", isAnalyzeResponse, signal, input),
    decidePrivacy: (input, signal) => request("/privacy/decisions", isPrivacyDecisionResponse, signal, input),
    async explain(input, signal) {
      const deadline = AbortSignal.timeout(explanationDeadlineMs);
      const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
      const result = await request("/explain", isExplainResponse, requestSignal, input).catch((error: unknown) => {
        if (deadline.aborted && !signal?.aborted) {
          throw new Error("The explanation request timed out. Try again.");
        }
        throw error;
      });
      const knownIds = new Set(evidenceIdsForRequest(input));
      if (result.evidence_event_ids.some((id) => !knownIds.has(id))) {
        throw new Error("Explanation cited an unknown evidence event ID.");
      }
      return result;
    },
  };
}

export function createApiClient(baseURL = configuredBaseURL) {
  const client = createTraceGuardClient({ baseUrl: baseURL.trim() || localBaseURL });
  return {
    listScenarios: client.listScenarios,
    decidePrivacy: client.decidePrivacy,
    analyze: (scenarioID: string, signal: AbortSignal) =>
      client.analyze({ scenario_id: scenarioID }, signal),
    explain: (finding: Finding, signal: AbortSignal) =>
      client.explain(createExplainRequest({
        finding,
        ruleSummary: finding.rule_id === "DENY_PURPOSE"
          ? "The transfer purpose must be on the policy allowlist."
          : "Transfers covered by the policy must use an allowed destination and purpose.",
      }), signal),
  };
}

export const api = createApiClient();
