package tracehttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/ports"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/enforcement"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
)

type server struct {
	fixtures      ports.Fixtures
	lineage       ports.Lineage
	detector      ports.Detector
	investigation investigation.Service
}

func Register(router *echo.Echo, fixtures ports.Fixtures, lineage ports.Lineage, detector ports.Detector, explanations investigation.Service) {
	api.RegisterHandlers(router, &server{fixtures: fixtures, lineage: lineage, detector: detector, investigation: explanations})
}

func (s *server) Healthz(c echo.Context) error {
	return c.JSON(http.StatusOK, api.Health{Status: "ok"})
}

func (s *server) ListScenarios(c echo.Context) error {
	result := []api.Scenario{}
	if s.fixtures != nil {
		for _, scenario := range s.fixtures.List() {
			result = append(result, api.Scenario{Id: scenario.ID, Label: scenario.Label})
		}
	}
	return c.JSON(http.StatusOK, result)
}

func (s *server) Analyze(c echo.Context) error {
	ctx := c.Request().Context()
	var request api.AnalyzeRequest
	if !decodeRequest(c, &request) {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Expected one JSON request object.")
	}
	var events []entities.Event
	var policy entities.Policy
	if request.ScenarioId != nil {
		if !entities.Meaningful(*request.ScenarioId) || (request.Events != nil && len(*request.Events) > 0) {
			return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Supply a scenario ID or explicit events and policy.")
		}
		if s.fixtures == nil {
			return fail(c, http.StatusNotFound, "SCENARIO_NOT_FOUND", "Unknown scenario.")
		}
		var err error
		events, policy, err = s.fixtures.Load(ctx, *request.ScenarioId)
		if errors.Is(err, ports.ErrScenarioNotFound) {
			return fail(c, http.StatusNotFound, "SCENARIO_NOT_FOUND", "Unknown scenario.")
		}
		if err != nil {
			return fail(c, http.StatusInternalServerError, "ANALYSIS_FAILED", "Could not load the scenario.")
		}
	} else if request.Events == nil || request.Policy == nil {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Supply a scenario ID or explicit events and policy.")
	} else {
		for _, event := range *request.Events {
			if !entities.Meaningful(event.EventId) || !entities.Meaningful(event.Service) || !entities.Meaningful(event.Action) || event.OccurredAt.IsZero() || event.ObservedAt.IsZero() || !validOutcome(string(event.Outcome)) {
				return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Each event must have an ID, service, action, valid outcome, and both timestamps.")
			}
			if blankEndpoint(event.SourceService) || blankEndpoint(event.DestinationService) {
				return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Supplied transfer endpoints must be nonblank.")
			}
			events = append(events, entities.Event{
				EventID: event.EventId, TraceID: optional(event.TraceId), TransferID: optional(event.TransferId),
				OccurredAt: event.OccurredAt, ObservedAt: event.ObservedAt,
				Service: event.Service, Action: event.Action, Outcome: string(event.Outcome),
				SourceService: optional(event.SourceService), DestinationService: optional(event.DestinationService),
				DataRef: optional(event.DataRef), Classification: optional(event.Classification), Purpose: optional(event.Purpose),
			})
		}
	}
	if p := request.Policy; p != nil {
		if !entities.Meaningful(p.PolicyId) || !entities.Meaningful(p.Classification) || p.AllowedDestinations == nil || p.AllowedPurposes == nil {
			return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Policy requires an ID, classification, allowed destinations, and allowed purposes.")
		}
		policy = entities.Policy{PolicyID: p.PolicyId, Classification: p.Classification, AllowedDestinations: p.AllowedDestinations, AllowedPurposes: p.AllowedPurposes}
	}
	events, graph, findings, err := s.analyze(ctx, events, policy)
	if err != nil {
		return fail(c, http.StatusInternalServerError, "ANALYSIS_FAILED", "Could not evaluate the policy.")
	}
	result := response(len(events), graph, findings)
	if request.ScenarioId != nil && request.Policy == nil {
		candidates := enforcement.Candidates(*request.ScenarioId, events, graph, policy)
		items := make([]api.TransferCandidate, 0, len(candidates))
		for _, candidate := range candidates {
			request := candidate.Request
			item := api.TransferCandidate{
				Id: candidate.ID, EdgeId: candidate.EdgeID, EvidenceEventIds: candidate.EvidenceEventIDs,
				EvidenceStatus: api.TransferCandidateEvidenceStatus(candidate.EvidenceStatus),
				SourceService:  request.SourceService, DestinationService: request.DestinationService, PolicyId: request.PolicyID,
			}
			if len(request.DataCategories) > 0 {
				item.Classification = &request.DataCategories[0]
			}
			if entities.Meaningful(request.Purpose) {
				item.Purpose = &request.Purpose
			}
			items = append(items, item)
		}
		result.TransferCandidates = &items
	}
	return c.JSON(http.StatusOK, result)
}

func (s *server) analyze(ctx context.Context, events []entities.Event, policy entities.Policy) ([]entities.Event, entities.Graph, []entities.Finding, error) {
	var graph entities.Graph
	if s.lineage != nil {
		events, graph = s.lineage.Reconstruct(events)
	}
	if s.detector == nil {
		return events, graph, nil, nil
	}
	findings, err := s.detector.Detect(ctx, events, graph, policy)
	return events, graph, findings, err
}

func response(count int, graph entities.Graph, findings []entities.Finding) api.AnalyzeResponse {
	result := api.AnalyzeResponse{
		Summary:  api.Summary{Status: api.Status(caseStatus(count, findings)), EventsProcessed: count},
		Graph:    api.Graph{Nodes: []api.Node{}, Edges: []api.Edge{}},
		Findings: []api.Finding{},
	}
	for _, node := range graph.Nodes {
		result.Graph.Nodes = append(result.Graph.Nodes, api.Node{Id: node.ID, Kind: node.Kind, Label: node.Label})
	}
	for _, edge := range graph.Edges {
		result.Graph.Edges = append(result.Graph.Edges, api.Edge{
			Id: edge.ID, Source: edge.Source, Target: edge.Target, EvidenceStatus: api.EdgeEvidenceStatus(edge.EvidenceStatus),
			EvidenceEventIds: append([]string{}, edge.EvidenceEventIDs...),
		})
	}
	for _, f := range findings {
		result.Findings = append(result.Findings, api.Finding{
			Id: f.ID, RuleId: f.RuleID, Status: api.Status(f.Status), Message: f.Message,
			EvidenceEventIds: append([]string{}, f.EvidenceEventIDs...), MissingEvidence: append([]string{}, f.MissingEvidence...),
		})
	}
	return result
}

func caseStatus(count int, findings []entities.Finding) entities.Status {
	status := entities.Inconclusive
	rank := map[entities.Status]int{entities.VerifiedViolation: 4, entities.PotentialViolation: 3, entities.Inconclusive: 2, entities.NoViolationObserved: 1}
	highest := 0
	for _, f := range findings {
		if severity := rank[f.Status]; count > 0 && severity > highest {
			highest = severity
			status = f.Status
		}
	}
	return status
}

func blankEndpoint(value *string) bool {
	return value != nil && !entities.Meaningful(*value)
}

func optional(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func validOutcome(outcome string) bool {
	return outcome == "COMPLETED" || outcome == "ATTEMPTED" || outcome == "FAILED"
}

func fail(c echo.Context, status int, code, message string) error {
	return c.JSON(status, api.Error{Code: code, Message: message})
}

func decodeRequest(c echo.Context, destination any) bool {
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, 2<<20)
	decoder := json.NewDecoder(c.Request().Body)
	return decoder.Decode(destination) == nil && decoder.Decode(new(any)) == io.EOF
}
