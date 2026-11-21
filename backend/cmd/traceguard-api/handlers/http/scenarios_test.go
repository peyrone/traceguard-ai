package tracehttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
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

func TestScenarioPipeline(t *testing.T) {
	router := echo.New()
	Register(router, fixtures.Store{}, lineage.Service{}, detection.Evaluator{}, investigation.New(nil))

	list := httptest.NewRecorder()
	router.ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/api/v1/scenarios", nil))
	var scenarios []api.Scenario
	if err := json.Unmarshal(list.Body.Bytes(), &scenarios); err != nil || list.Code != http.StatusOK || len(scenarios) != 5 {
		t.Fatalf("scenarios: %d %s (%v)", list.Code, list.Body.String(), err)
	}

	post := func(body string) api.AnalyzeResponse {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		var response api.AnalyzeResponse
		if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || res.Code != http.StatusOK {
			t.Fatalf("analyze %s: %d %s (%v)", body, res.Code, res.Body.String(), err)
		}
		return response
	}
	analyze := func(id string) api.AnalyzeResponse {
		return post(`{"scenario_id":"` + id + `"}`)
	}
	if allowed := analyze("allowed_transfer"); allowed.Summary.Status != api.Status(entities.NoViolationObserved) ||
		len(allowed.Graph.Nodes) != 5 || len(allowed.Graph.Edges) != 4 {
		t.Fatalf("unexpected allowed result: %+v", allowed)
	}
	direct := analyze("unauthorized_transfer")
	if direct.Summary.Status != api.Status(entities.VerifiedViolation) || direct.Summary.EventsProcessed != 6 ||
		len(direct.Graph.Nodes) != 6 || len(direct.Graph.Edges) != 5 {
		t.Fatalf("unexpected direct transfer result: %+v", direct)
	}
	shuffled := analyze("shuffled_transfer")
	// The shuffled fixture has its own event IDs and identifiers derived from them.
	shuffled.TransferCandidates, direct.TransferCandidates = nil, nil
	if len(direct.Findings) != 1 || len(shuffled.Findings) != 1 ||
		shuffled.Findings[0].Id == direct.Findings[0].Id {
		t.Fatalf("expected distinct finding IDs, got %+v and %+v", direct.Findings, shuffled.Findings)
	}
	direct.Findings[0].Id = shuffled.Findings[0].Id
	direct.Findings[0].EvidenceEventIds = []string{"evt-s-003"}
	for _, edge := range direct.Graph.Edges {
		for i, id := range edge.EvidenceEventIds {
			edge.EvidenceEventIds[i] = "evt-s-" + strings.TrimPrefix(id, "evt-u-")
		}
	}
	if !reflect.DeepEqual(shuffled, direct) {
		t.Fatalf("shuffled response differs: %+v", shuffled)
	}
	missing := analyze("missing_intermediate")
	if missing.Summary.Status != api.Status(entities.PotentialViolation) || len(missing.Graph.Nodes) != 5 ||
		len(missing.Graph.Edges) != 4 {
		t.Fatalf("unexpected missing result: %+v", missing)
	}
	found := false
	for _, edge := range missing.Graph.Edges {
		found = found || edge.Target == "external-crm"
		if edge.Target == "external-crm" && (edge.EvidenceStatus != api.EdgeEvidenceStatus(entities.Inferred) ||
			!reflect.DeepEqual(edge.EvidenceEventIds, []string{"evt-m-001", "evt-m-004"})) {
			t.Fatalf("unexpected missing edge: %+v", edge)
		}
	}
	if !found || len(missing.Findings) != 1 || missing.Findings[0].Status != api.Status(entities.PotentialViolation) ||
		!reflect.DeepEqual(missing.Findings[0].EvidenceEventIds, []string{"evt-m-004"}) || len(missing.Findings[0].MissingEvidence) == 0 {
		t.Fatalf("missing inferred evidence or finding: %+v", missing)
	}

	const id = "partial_evidence_confirmed"
	if scenarios[4].Id != id {
		t.Fatalf("unexpected fifth scenario: %+v", scenarios[4])
	}
	check := func(got api.AnalyzeResponse, overall entities.Status, outboundEvidence entities.EvidenceStatus, outboundStatus entities.Status) {
		t.Helper()
		count := 1
		if outboundEvidence != "" {
			count++
		}
		if got.Summary.Status != api.Status(overall) || got.Summary.EventsProcessed != count+2 ||
			len(got.Graph.Nodes) != count+3 || len(got.Graph.Edges) != count+2 || len(got.Findings) != count {
			t.Fatalf("unexpected summary, edges, or findings: %+v", got)
		}
		for i, want := range []struct {
			source, target, eventID string
			evidence                entities.EvidenceStatus
			status                  entities.Status
			rule                    string
		}{
			{"customer-api", "sales-api", "evt-e-001", entities.Inferred, entities.Inconclusive, "TRANSFER_POLICY"},
			{"sales-api", "external-crm", "evt-e-002", outboundEvidence, outboundStatus, "DENY_EXTERNAL_PII"},
		}[:count] {
			edgeIndex := slices.IndexFunc(got.Graph.Edges, func(edge api.Edge) bool {
				return edge.Source == want.source && edge.Target == want.target
			})
			if edgeIndex < 0 {
				t.Fatalf("missing edge %s -> %s", want.source, want.target)
			}
			edge, finding := got.Graph.Edges[edgeIndex], got.Findings[i]
			ids := []string{want.eventID}
			gaps := []string{"observed completed send with matching endpoints"}
			if want.status == entities.VerifiedViolation {
				gaps = []string{}
			}
			if edge.Source != want.source || edge.Target != want.target || edge.EvidenceStatus != api.EdgeEvidenceStatus(want.evidence) ||
				!reflect.DeepEqual(edge.EvidenceEventIds, ids) {
				t.Errorf("unexpected edge %d: %+v", i, edge)
			}
			if finding.Status != api.Status(want.status) || finding.RuleId != want.rule ||
				!reflect.DeepEqual(finding.EvidenceEventIds, ids) || !reflect.DeepEqual(finding.MissingEvidence, gaps) {
				t.Errorf("unexpected finding %d: %+v", i, finding)
			}
		}
	}
	partial := analyze(id)
	check(partial, entities.VerifiedViolation, entities.Observed, entities.VerifiedViolation)

	events, policy, err := (fixtures.Store{}).Load(context.Background(), id)
	if err != nil || len(events) != 4 {
		t.Fatalf("load scenario: %v, events: %d", err, len(events))
	}
	analyzeEvents := func(events ...entities.Event) api.AnalyzeResponse {
		t.Helper()
		body, err := json.Marshal(struct {
			Events []entities.Event `json:"events"`
			Policy entities.Policy  `json:"policy"`
		}{Events: events, Policy: policy})
		if err != nil {
			t.Fatal(err)
		}
		return post(string(body))
	}
	shuffledEvents := slices.Clone(events)
	slices.Reverse(shuffledEvents)
	partial.TransferCandidates = nil // Explicit event inputs do not expose fixture candidates.
	if shuffled := analyzeEvents(shuffledEvents...); !reflect.DeepEqual(shuffled, partial) {
		t.Fatalf("shuffled partial evidence response differs: %+v", shuffled)
	}
	withoutOutbound := slices.DeleteFunc(slices.Clone(events), func(event entities.Event) bool {
		return event.EventID == "evt-e-002"
	})
	check(analyzeEvents(withoutOutbound...), entities.Inconclusive, "", "")
	for _, outcome := range []string{"ATTEMPTED", "FAILED"} {
		modified := slices.Clone(events)
		outboundIndex := slices.IndexFunc(modified, func(event entities.Event) bool {
			return event.EventID == "evt-e-002"
		})
		if outboundIndex < 0 {
			t.Fatal("fixture missing evt-e-002")
		}
		modified[outboundIndex].Outcome = outcome
		check(analyzeEvents(modified...), entities.PotentialViolation, entities.Inferred, entities.PotentialViolation)
	}
}
