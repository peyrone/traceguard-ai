package tracehttp

import (
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
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/detection"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func TestScenarioPipeline(t *testing.T) {
	router := echo.New()
	Register(router, fixtures.Store{}, lineage.Service{}, detection.Evaluator{}, investigation.New(nil))

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
	if allowed := analyze("allowed_transfer"); allowed.Summary.Status != api.Status(entities.NoViolationObserved) {
		t.Fatalf("unexpected allowed result: %+v", allowed)
	}
	direct := analyze("unauthorized_transfer")
	if direct.Summary.Status != api.Status(entities.VerifiedViolation) || direct.Summary.EventsProcessed != 3 {
		t.Fatalf("unexpected direct transfer result: %+v", direct)
	}
	if shuffled := analyze("shuffled_transfer"); !reflect.DeepEqual(shuffled, direct) {
		t.Fatalf("shuffled response differs: %+v", shuffled)
	}
	missing := analyze("missing_intermediate")
	if missing.Summary.Status != api.Status(entities.PotentialViolation) || len(missing.Graph.Edges) != 2 {
		t.Fatalf("unexpected missing result: %+v", missing)
	}
	found := false
	for _, edge := range missing.Graph.Edges {
		found = found || edge.Target == "external-crm"
		if edge.Target == "external-crm" && (edge.EvidenceStatus != api.EdgeEvidenceStatus(entities.Inferred) ||
			!reflect.DeepEqual(edge.EvidenceEventIds, []string{"evt-001", "evt-004"})) {
			t.Fatalf("unexpected missing edge: %+v", edge)
		}
	}
	if !found || len(missing.Findings) != 1 || missing.Findings[0].Status != api.Status(entities.PotentialViolation) || len(missing.Findings[0].MissingEvidence) == 0 {
		t.Fatalf("missing inferred evidence or finding: %+v", missing)
	}
}
