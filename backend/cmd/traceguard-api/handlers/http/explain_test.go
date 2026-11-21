package tracehttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/detection"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

type explanationProvider func(context.Context, investigation.Request) (investigation.Suggestion, error)

func (f explanationProvider) Suggest(ctx context.Context, request investigation.Request) (investigation.Suggestion, error) {
	return f(ctx, request)
}

func TestExplainHTTP(t *testing.T) {
	const payload = `{
		"finding":{"id":"finding-1","rule_id":"DENY_EXTERNAL_PII","status":"POTENTIAL_VIOLATION",
		"message":"The receipt indicates a policy concern.","evidence_event_ids":["evt-004","absent"],"missing_evidence":["completed send"]},
		"rule_summary":"PII destinations must be approved.",
		"evidence":[{"event_id":"evt-004","action":"DATA_RECEIVED","outcome":"COMPLETED"}]
	}`
	type contextKey struct{}
	ctx, cancel := context.WithCancel(context.WithValue(t.Context(), contextKey{}, true))
	defer cancel()
	post := func(service investigation.Service, body string) *httptest.ResponseRecorder {
		router := echo.New()
		Register(router, nil, nil, nil, service)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/explain", strings.NewReader(body)).WithContext(ctx)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	fallback := post(investigation.New(nil), payload)
	if fallback.Code != http.StatusOK || !strings.Contains(fallback.Body.String(), `"mode":"fallback"`) ||
		!strings.Contains(fallback.Body.String(), `"evidence_event_ids":["evt-004"]`) ||
		!strings.Contains(fallback.Body.String(), "Potential violation.") {
		t.Fatalf("fallback response: %d %s", fallback.Code, fallback.Body.String())
	}
	providerFailure := investigation.New(explanationProvider(func(ctx context.Context, request investigation.Request) (investigation.Suggestion, error) {
		if ctx.Value(contextKey{}) != true || ctx.Done() == nil || request.Status != entities.PotentialViolation || len(request.Evidence) != 1 {
			t.Fatalf("provider context or request is incorrect: %+v", request)
		}
		return investigation.Suggestion{}, errors.New("provider unavailable")
	}))
	failed := post(providerFailure, payload)
	if failed.Code != fallback.Code || failed.Body.String() != fallback.Body.String() {
		t.Fatalf("provider failure response: %d %s", failed.Code, failed.Body.String())
	}
	providerSuccess := investigation.New(explanationProvider(func(_ context.Context, _ investigation.Request) (investigation.Suggestion, error) {
		return investigation.Suggestion{Status: entities.PotentialViolation, EvidenceRefs: []string{"E1"}, StepIDs: []string{"check_policy"}}, nil
	}))
	if res := post(providerSuccess, payload); res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"mode":"ai"`) ||
		!strings.Contains(res.Body.String(), "Potential violation.") || !strings.Contains(res.Body.String(), `"evidence_event_ids":["evt-004"]`) {
		t.Fatalf("AI response: %d %s", res.Code, res.Body.String())
	}
	if invalid := post(investigation.New(nil), strings.Replace(payload, "POTENTIAL_VIOLATION", "UNKNOWN", 1)); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid classification response: %d %s", invalid.Code, invalid.Body.String())
	}
	canceledProvider := investigation.New(explanationProvider(func(providerCtx context.Context, _ investigation.Request) (investigation.Suggestion, error) {
		cancel()
		if !errors.Is(providerCtx.Err(), context.Canceled) {
			t.Fatal("provider did not receive request cancellation")
		}
		return investigation.Suggestion{}, providerCtx.Err()
	}))
	if res := post(canceledProvider, payload); res.Code != fallback.Code || res.Body.String() != fallback.Body.String() {
		t.Fatalf("canceled response: %d %s", res.Code, res.Body.String())
	}

}

func TestFixtureExplanation(t *testing.T) {
	for _, tc := range []struct {
		scenario, event, transfer, gap, action, rejected string
		status                                           entities.Status
	}{
		{"missing_intermediate", "evt-004", "INFERRED", "completed_send", "collect_completed_send", "review_export", entities.PotentialViolation},
		{"partial_evidence_confirmed", "evt-e-001", "INFERRED", "completed_send", "collect_completed_send", "review_export", entities.Inconclusive},
		{"partial_evidence_confirmed", "evt-e-002", "OBSERVED", "", "review_export", "collect_completed_send", entities.VerifiedViolation},
		{"shuffled_transfer", "evt-003", "OBSERVED", "", "review_export", "collect_completed_send", entities.VerifiedViolation},
	} {
		t.Run(tc.scenario+"/"+tc.event, func(t *testing.T) {
			for _, failure := range []string{"", "action", "status", "citation", "article", "insight_citation", "provider", "timeout"} {
				router := echo.New()
				provider := explanationProvider(func(_ context.Context, input investigation.Request) (investigation.Suggestion, error) {
					raw, _ := json.Marshal(input)
					var facts struct {
						Rule           string   `json:"rule"`
						Classification string   `json:"classification"`
						Missing        []string `json:"missing_evidence"`
						Actions        []string `json:"applicable_step_ids"`
						Evidence       []struct{ Ref, Action, Outcome, Transfer string }
					}
					if err := json.Unmarshal(raw, &facts); err != nil {
						t.Fatal(err)
					}
					if input.Status != tc.status || facts.Rule == "" || facts.Classification != "PII" ||
						len(facts.Evidence) != 1 || facts.Evidence[0].Transfer != tc.transfer || facts.Evidence[0].Outcome != "COMPLETED" ||
						!slices.Contains(facts.Actions, tc.action) || slices.Contains(facts.Actions, tc.rejected) ||
						(tc.gap != "" && !slices.Contains(facts.Missing, tc.gap)) || (tc.gap == "" && len(facts.Missing) != 0) ||
						strings.Contains(string(raw), tc.event) {
						t.Fatalf("unexpected provider facts: %s", raw)
					}
					ranking := investigation.ReviewRanking{Insights: []investigation.ReviewSelection{}, Mappings: []investigation.ReviewSelection{}}
					if input.Review != nil {
						for _, item := range input.Review.Insights {
							ranking.Insights = append(ranking.Insights, item.ReviewSelection)
						}
						for _, item := range input.Review.Mappings {
							ranking.Mappings = append(ranking.Mappings, item.ReviewSelection)
						}
					}
					result := investigation.Suggestion{Status: tc.status, EvidenceRefs: []string{"E1"}, StepIDs: []string{tc.action}, Review: &ranking}
					switch failure {
					case "action":
						result.StepIDs = []string{tc.rejected}
					case "status":
						result.Status = entities.NoViolationObserved
					case "citation":
						result.EvidenceRefs = []string{"E999"}
					case "article":
						ranking.Mappings = []investigation.ReviewSelection{{ID: "44", EvidenceRefs: []string{"E1"}}}
					case "insight_citation":
						ranking.Insights[0].EvidenceRefs = []string{"E999"}
					case "provider":
						return investigation.Suggestion{}, errors.New("provider unavailable")
					case "timeout":
						return investigation.Suggestion{}, context.DeadlineExceeded
					}
					return result, nil
				})
				Register(router, fixtures.Store{}, lineage.Service{}, detection.Evaluator{}, investigation.New(provider))
				post := func(path string, data any) *httptest.ResponseRecorder {
					body, err := json.Marshal(data)
					if err != nil {
						t.Fatal(err)
					}
					rec := httptest.NewRecorder()
					router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(string(body))))
					if rec.Code != http.StatusOK {
						t.Fatalf("%s: %d %s", path, rec.Code, rec.Body)
					}
					return rec
				}
				var analysis api.AnalyzeResponse
				if err := json.Unmarshal(post("/api/v1/analyze", map[string]string{"scenario_id": tc.scenario}).Body.Bytes(), &analysis); err != nil {
					t.Fatal(err)
				}
				index := slices.IndexFunc(analysis.Findings, func(f api.Finding) bool { return slices.Contains(f.EvidenceEventIds, tc.event) })
				if index < 0 {
					t.Fatal("fixture finding not found")
				}
				result := post("/api/v1/explain", map[string]any{"finding": analysis.Findings[index], "rule_summary": "Untrusted details", "evidence": []map[string]string{{"event_id": tc.event}}})
				var explained api.ExplainResponse
				if err := json.Unmarshal(result.Body.Bytes(), &explained); err != nil {
					t.Fatal(err)
				}
				want := "ai"
				if failure != "" {
					want = "fallback"
				}
				if string(explained.Mode) != want || !slices.Equal(explained.EvidenceEventIds, []string{tc.event}) || len(explained.NextSteps) == 0 || explained.Insights == nil || len(*explained.Insights) == 0 {
					t.Fatalf("%s: unexpected explanation: %+v", failure, explained)
				}
			}
		})
	}
}
