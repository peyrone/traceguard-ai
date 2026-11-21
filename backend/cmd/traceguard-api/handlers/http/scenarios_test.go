package tracehttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func TestScenarioPipeline(t *testing.T) {
	router := echo.New()
	detector := &recordingDetector{}
	Register(router, fixtures.Store{}, lineage.Service{}, detector)

	list := httptest.NewRecorder()
	router.ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/api/v1/scenarios", nil))
	var scenarios []api.Scenario
	if err := json.Unmarshal(list.Body.Bytes(), &scenarios); err != nil || list.Code != http.StatusOK || len(scenarios) != 4 {
		t.Fatalf("scenarios: %d %s (%v)", list.Code, list.Body.String(), err)
	}

	analyze := func(id string) api.AnalyzeResponse {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", strings.NewReader(`{"scenario_id":"`+id+`"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		var response api.AnalyzeResponse
		if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || res.Code != http.StatusOK {
			t.Fatalf("analyze %s: %d %s (%v)", id, res.Code, res.Body.String(), err)
		}
		return response
	}
	direct := analyze("unauthorized_transfer")
	if direct.Summary.Status != api.Status(entities.VerifiedViolation) || direct.Summary.EventsProcessed != 3 || detector.policy.PolicyID != "policy-001" {
		t.Fatalf("unexpected direct transfer result: %+v", direct)
	}
	if shuffled := analyze("shuffled_transfer"); !reflect.DeepEqual(shuffled, direct) {
		t.Fatalf("shuffled response differs: %+v", shuffled)
	}
	missing := analyze("missing_intermediate")
	if missing.Summary.Status != api.Status(entities.Inconclusive) || len(missing.Graph.Edges) != 2 {
		t.Fatalf("unexpected missing result: %+v", missing)
	}
	for _, edge := range missing.Graph.Edges {
		if edge.Target == "external-crm" && (edge.EvidenceStatus != api.EdgeEvidenceStatus(entities.Inferred) ||
			!reflect.DeepEqual(edge.EvidenceEventIds, []string{"evt-001", "evt-004"})) {
			t.Fatalf("unexpected missing edge: %+v", edge)
		}
	}
}

type recordingDetector struct {
	policy entities.Policy
}

func (d *recordingDetector) Detect(_ context.Context, events []entities.Event, _ entities.Graph, policy entities.Policy) ([]entities.Finding, error) {
	d.policy = policy
	for _, event := range events {
		if event.EventID == "evt-003" {
			return []entities.Finding{{
				ID: "finding-1", RuleID: "DENY_EXTERNAL_PII", Status: entities.VerifiedViolation,
				Message: "Completed transfer to an unapproved destination", EvidenceEventIDs: []string{event.EventID},
			}}, nil
		}
	}
	return nil, nil
}
