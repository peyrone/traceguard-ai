package tracehttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/ports"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func TestPrivacyDecisionHTTP(t *testing.T) {
	router := echo.New()
	Register(router, fixtures.Store{}, nil, nil, investigation.New(nil))
	const valid = `{"source_service":"customer-api","destination_service":"sales-api","data_categories":["PII"],"purpose":"CUSTOMER_SERVICE","policy_id":"policy-001"}`
	for _, tc := range []struct {
		name, body, rule string
		decision         api.PrivacyDecisionResponseDecision
	}{
		{"allowed", valid, "TRANSFER_POLICY", api.ALLOW},
		{"denied destination", strings.Replace(valid, "sales-api", "external-crm", 1), "DENY_EXTERNAL_PII", api.DENY},
		{"legacy request excludes scenario-only destination", strings.Replace(valid, "sales-api", "internal-gateway", 1), "DENY_EXTERNAL_PII", api.DENY},
		{"denied purpose", strings.Replace(valid, "CUSTOMER_SERVICE", "MARKETING", 1), "DENY_PURPOSE", api.DENY},
		{"unknown policy", strings.Replace(valid, "policy-001", "unknown", 1), "TRANSFER_POLICY", api.INDETERMINATE},
		{"missing attributes", "{}", "TRANSFER_POLICY", api.INDETERMINATE},
		{"wrong type", `{"purpose":42}`, "", ""},
		{"null body", "null", "", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/privacy/decisions", strings.NewReader(tc.body)))
			if tc.decision == "" {
				var got api.Error
				if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || rec.Code != http.StatusBadRequest || got.Code != "INVALID_REQUEST" {
					t.Fatalf("expected error envelope, got %d %s", rec.Code, rec.Body)
				}
				return
			}
			var got api.PrivacyDecisionResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || rec.Code != http.StatusOK ||
				got.Decision != tc.decision || got.RuleId != tc.rule || got.Reason == "" ||
				got.TransferExecuted != (tc.decision == api.ALLOW) {
				t.Fatalf("unexpected decision: %d %s", rec.Code, rec.Body)
			}
		})
	}
}

func TestScenarioPrivacyDecisionHTTP(t *testing.T) {
	router := echo.New()
	Register(router, fixtures.Store{}, lineage.Service{}, nil, investigation.New(nil))
	post := func(path string, data map[string]string) *httptest.ResponseRecorder {
		t.Helper()
		body, err := json.Marshal(data)
		if err != nil {
			t.Fatal(err)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(string(body))))
		return rec
	}
	for _, tc := range []struct {
		scenario, event, source, destination, classification, purpose string
		decision                                                      api.PrivacyDecisionResponseDecision
	}{
		{"allowed_transfer", "evt-a-001", "customer-api", "sales-api", "PII", "CUSTOMER_SERVICE", api.ALLOW},
		{"allowed_transfer", "evt-a-005", "customer-api", "consent-api", "PII", "CUSTOMER_SERVICE", api.ALLOW},
		{"allowed_transfer", "evt-a-006", "sales-api", "internal-gateway", "PII", "CUSTOMER_SERVICE", api.ALLOW},
		{"allowed_transfer", "evt-a-007", "internal-gateway", "internal-crm", "PII", "CUSTOMER_SERVICE", api.ALLOW},
		{"unauthorized_transfer", "evt-u-003", "sales-api", "external-crm", "PII", "MARKETING", api.DENY},
		{"unauthorized_transfer", "evt-u-006", "sales-api", "internal-gateway", "PII", "CUSTOMER_SERVICE", api.ALLOW},
		{"shuffled_transfer", "evt-s-003", "sales-api", "external-crm", "PII", "MARKETING", api.DENY},
		{"missing_intermediate", "evt-m-004", "sales-api", "external-crm", "", "", api.INDETERMINATE},
		{"partial_evidence_confirmed", "evt-e-001", "customer-api", "sales-api", "", "", api.INDETERMINATE},
		{"partial_evidence_confirmed", "evt-e-002", "sales-api", "external-crm", "PII", "CUSTOMER_SERVICE", api.DENY},
	} {
		t.Run(tc.scenario+"/"+tc.event, func(t *testing.T) {
			var analysis api.AnalyzeResponse
			rec := post("/api/v1/analyze", map[string]string{"scenario_id": tc.scenario})
			if err := json.Unmarshal(rec.Body.Bytes(), &analysis); err != nil || rec.Code != http.StatusOK || analysis.TransferCandidates == nil {
				t.Fatalf("analysis: %d %s", rec.Code, rec.Body)
			}
			candidates := *analysis.TransferCandidates
			index := slices.IndexFunc(candidates, func(c api.TransferCandidate) bool { return slices.Contains(c.EvidenceEventIds, tc.event) })
			if index < 0 {
				t.Fatalf("no candidate for %s", tc.event)
			}
			c := candidates[index]
			if c.SourceService != tc.source || c.DestinationService != tc.destination || optional(c.Classification) != tc.classification ||
				optional(c.Purpose) != tc.purpose || c.PolicyId != "policy-001" {
				t.Fatalf("wrong attributes: %+v", c)
			}
			check := func(scenario, candidate string, code int) *httptest.ResponseRecorder {
				t.Helper()
				got := post("/api/v1/privacy/decisions", map[string]string{"scenario_id": scenario, "candidate_id": candidate})
				if got.Code != code {
					t.Fatalf("decision response: %d %s", got.Code, got.Body)
				}
				return got
			}
			result := check(tc.scenario, c.Id, http.StatusOK)
			var got api.PrivacyDecisionResponse
			if err := json.Unmarshal(result.Body.Bytes(), &got); err != nil || got.Decision != tc.decision || got.TransferExecuted != (tc.decision == api.ALLOW) {
				t.Fatalf("wrong decision: %s", result.Body)
			}
			other := "shuffled_transfer"
			if tc.scenario == other {
				other = "unauthorized_transfer"
			}
			check(other, c.Id, http.StatusNotFound)
			check(tc.scenario, "unknown", http.StatusNotFound)
			check("unknown", c.Id, http.StatusNotFound)
			check(tc.scenario, "", http.StatusBadRequest)
			mixed := post("/api/v1/privacy/decisions", map[string]string{"scenario_id": tc.scenario, "candidate_id": c.Id, "purpose": "UNTRUSTED"})
			if mixed.Code != http.StatusBadRequest {
				t.Fatalf("accepted explicit override: %d %s", mixed.Code, mixed.Body)
			}
		})
	}
}

type restrictedAllowedFixture struct{ fixtures.Store }

func (store restrictedAllowedFixture) Load(ctx context.Context, id string) ([]entities.Event, entities.Policy, error) {
	events, policy, err := store.Store.Load(ctx, id)
	if id == "allowed_transfer" {
		policy.AllowedDestinations = []string{"sales-api", "customer-api"}
	}
	return events, policy, err
}

func TestScenarioPolicyIsolation(t *testing.T) {
	for _, tc := range []struct {
		name            string
		store           ports.Fixtures
		allowedDecision api.PrivacyDecisionResponseDecision
	}{
		{"original allowed policy", fixtures.Store{}, api.ALLOW},
		{"restricted allowed policy", restrictedAllowedFixture{}, api.DENY},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := echo.New()
			Register(router, tc.store, lineage.Service{}, nil, investigation.New(nil))
			post := func(path string, input map[string]any, output any) {
				t.Helper()
				body, err := json.Marshal(input)
				if err != nil {
					t.Fatal(err)
				}
				rec := httptest.NewRecorder()
				router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(string(body))))
				if err := json.Unmarshal(rec.Body.Bytes(), output); rec.Code != http.StatusOK || err != nil {
					t.Fatalf("%s: %d %s", path, rec.Code, rec.Body)
				}
			}
			check := func(input map[string]any, want api.PrivacyDecisionResponseDecision) {
				t.Helper()
				var decision api.PrivacyDecisionResponse
				post("/api/v1/privacy/decisions", input, &decision)
				if decision.Decision != want || decision.TransferExecuted != (want == api.ALLOW) {
					t.Fatalf("input %v: got %+v, want %s", input, decision, want)
				}
			}
			for _, scenario := range []string{"allowed_transfer", "unauthorized_transfer"} {
				var analysis api.AnalyzeResponse
				post("/api/v1/analyze", map[string]any{"scenario_id": scenario}, &analysis)
				if analysis.TransferCandidates == nil {
					t.Fatalf("%s returned no candidates", scenario)
				}
				candidates := *analysis.TransferCandidates
				index := slices.IndexFunc(candidates, func(c api.TransferCandidate) bool {
					return c.SourceService == "sales-api" && c.DestinationService == "internal-gateway" &&
						optional(c.Classification) == "PII" && optional(c.Purpose) == "CUSTOMER_SERVICE"
				})
				if index < 0 {
					t.Fatalf("%s returned no internal-gateway candidate with matching attributes", scenario)
				}
				want := api.ALLOW
				if scenario == "allowed_transfer" {
					want = tc.allowedDecision
				}
				check(map[string]any{"scenario_id": scenario, "candidate_id": candidates[index].Id}, want)
			}
			check(map[string]any{
				"source_service": "sales-api", "destination_service": "internal-gateway",
				"data_categories": []string{"PII"}, "purpose": "CUSTOMER_SERVICE", "policy_id": "policy-001",
			}, api.DENY)
		})
	}
}
